(() => {
  const money = n => new Intl.NumberFormat('en-ZA',{style:'currency',currency:'ZAR',maximumFractionDigits:2}).format(Number(n)||0);
  const cleanNum = s => Number(String(s||'').replace(/R/gi,'').replace(/\s/g,'').replace(/,/g,''));
  const normalise = s => String(s||'').replace(/\u00a0/g,' ').replace(/\s+/g,' ').trim();

  function upsertFund(fund, date){
    const key = fund.name.toLowerCase().replace(/[^a-z0-9]/g,'');
    let existing = data.investments.find(x => x.name.toLowerCase().replace(/[^a-z0-9]/g,'') === key);
    if(!existing){
      existing = {name:fund.name,type:fund.type,value:0,contribution:fund.contribution||0,target:fund.target||0,annualReturn:fund.annualReturn||9,history:[]};
      data.investments.push(existing);
    }
    existing.type = fund.type || existing.type;
    existing.value = Number(fund.value)||0;
    if(fund.contribution !== undefined) existing.contribution = Number(fund.contribution)||0;
    existing.history = Array.isArray(existing.history) ? existing.history : [];
    if(!existing.history.some(h => h.date===date && Number(h.value)===Number(existing.value))) existing.history.push({date,value:existing.value});
    if(fund.meta) existing.meta = {...(existing.meta||{}),...fund.meta};
    return existing;
  }

  function parseStanlib(text){
    const funds=[];
    const patterns=[
      ['Standard STANLIB Flexible Growth FoF B1','Unit Trust'],
      ['STANLIB Global Balanced Feeder Fund B1','Unit Trust'],
      ['STANLIB Absolute Plus Fund B1','Unit Trust'],
      ['STANLIB Multi-Asset Growth Fund B1','Unit Trust']
    ];
    for(const [name,type] of patterns){
      const escaped=name.replace(/[.*+?^${}()|[\]\\]/g,'\\$&').replace(/\s+/g,'\\s*');
      const re=new RegExp(escaped+'[\\s\\S]{0,260}?Closing\\s+market\\s+value\\s+([0-9][0-9 \\,]*\\.\\d{2})','i');
      let m=text.match(re);
      if(!m){
        const re2=new RegExp(escaped+'[\\s\\S]{0,180}?([0-9][0-9 \\,]*\\.\\d{2})\\s+[0-9][0-9 \\,]*\\.\\d{2}\\s+[0-9][0-9 \\,]*\\.\\d{4}\\s+([0-9][0-9 \\,]*\\.\\d{2})','i');
        m=text.match(re2); if(m) m=[m[0],m[2]];
      }
      if(m) funds.push({name,type,value:cleanNum(m[1]),contribution:0,annualReturn:9});
    }
    if(!funds.length){
      const closing=[...text.matchAll(/Closing\s+market\s+value\s+([0-9][0-9 \,]*\.\d{2})/gi)].map(m=>cleanNum(m[1]));
      const names=[...text.matchAll(/(?:Standard\s+)?STANLIB\s+[A-Za-z\- ]+(?:Fund|FoF)\s+B\s*1/gi)].map(m=>normalise(m[0]));
      names.slice(0,closing.length).forEach((name,i)=>funds.push({name,type:'Unit Trust',value:closing[i],contribution:0,annualReturn:9}));
    }
    return funds;
  }

  function parseInn8(text){
    const m=text.match(/Closing value for the statement period\s*:?\s*R?\s*([0-9][0-9 \,]*\.\d{2})/i) || text.match(/TOTAL MARKET VALUE[\s\S]{0,100}?([0-9][0-9 \,]*\.\d{2})\s*$/im);
    if(!m) return [];
    const ror=text.match(/Rate of return[^:]*:\s*([0-9.]+)%/i);
    const fee=text.match(/Fees\s*:?\s*R?\s*-?([0-9][0-9 \,]*\.\d{2})/i);
    return [{name:'INN8 Retirement Annuity',type:'Retirement Annuity',value:cleanNum(m[1]),contribution:0,annualReturn:9,meta:{statementReturn:ror?Number(ror[1]):null,periodFees:fee?cleanNum(fee[1]):null}}];
  }

  function parseAlexanderForbes(text){
    const m=text.match(/Closing balance as at[^R]*R\s*([0-9][0-9 \,]*\.\d{2})/i) || text.match(/retirement benefit as at[^R]*R\s*([0-9][0-9 \,]*\.\d{2})/i);
    if(!m) return [];
    const employer=text.match(/Employer Contribution Rate\s*([0-9.]+)%/i);
    return [{name:'Alexander Forbes Provident Fund',type:'Provident Fund',value:cleanNum(m[1]),contribution:4967.46,annualReturn:9,meta:{employerContributionRate:employer?Number(employer[1]):null}}];
  }

  async function extractText(file){
    const buffer=await file.arrayBuffer();
    const pdf=await pdfjsLib.getDocument({data:buffer}).promise;
    let text='';
    for(let i=1;i<=pdf.numPages;i++){
      const page=await pdf.getPage(i);
      const content=await page.getTextContent();
      text += '\n' + content.items.map(x=>x.str).join(' ');
    }
    return normalise(text);
  }

  document.getElementById('investmentStatementInput')?.addEventListener('change', async e => {
    const file=e.target.files?.[0];
    const status=document.getElementById('investmentImportStatus');
    if(!file) return;
    status.textContent='Reading investment statement…';
    try{
      const text=await extractText(file);
      let funds=[];
      if(/STANLIB Unit Trusts|Flexible Growth FoF|Global Balanced Feeder/i.test(text)) funds.push(...parseStanlib(text));
      if(/INN8|Retirement Annuity|RA105641/i.test(text)) funds.push(...parseInn8(text));
      if(/Alexander Forbes Retirement Fund|Benefit Statement/i.test(text)) funds.push(...parseAlexanderForbes(text));
      const unique=[]; const seen=new Set();
      for(const f of funds){const k=f.name.toLowerCase();if(!seen.has(k)&&f.value>0){seen.add(k);unique.push(f)}}
      if(!unique.length) throw new Error('No supported investment balances were found.');
      const dateMatch=text.match(/Statement Date\s*(\d{2})\/(\d{2})\/(\d{4})/i)||text.match(/Document date\s*:?\s*(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})/i)||text.match(/Benefit Statement at\s*(\d{2})\/(\d{2})\/(\d{4})/i);
      let date=new Date().toISOString().slice(0,10);
      if(dateMatch && /^\d+$/.test(dateMatch[2])) date=`${dateMatch[3]}-${dateMatch[2].padStart(2,'0')}-${dateMatch[1].padStart(2,'0')}`;
      unique.forEach(f=>upsertFund(f,date));
      save(); if(typeof render==='function') render();
      status.innerHTML=`Imported ${unique.length} fund${unique.length===1?'':'s'}: ${unique.map(f=>`${f.name} (${money(f.value)})`).join(', ')}.`;
    }catch(err){status.textContent=`Import failed: ${err.message}`}
    e.target.value='';
  });
})();