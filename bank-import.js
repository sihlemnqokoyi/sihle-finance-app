function sfText(value){return String(value??"").trim();}
function sfAmount(value){
  if(typeof value==="number") return value;
  const cleaned=String(value??"").replace(/R/g,"").replace(/\s/g,"").replace(/,/g,"");
  const number=Number(cleaned);
  return Number.isFinite(number)?number:0;
}
function sfDate(value){
  if(value instanceof Date) return value.toISOString().slice(0,10);
  if(typeof value==="number"&&window.XLSX){
    const parsed=XLSX.SSF.parse_date_code(value);
    if(parsed) return `${parsed.y}-${String(parsed.m).padStart(2,"0")}-${String(parsed.d).padStart(2,"0")}`;
  }
  const date=new Date(value);
  return Number.isNaN(date.getTime())?new Date().toISOString().slice(0,10):date.toISOString().slice(0,10);
}
function sfCategory(description,type=""){
  const text=(description+" "+type).toUpperCase();
  if(/TRANSFER|TO:\s*\d+|PAYMENT OF OVER LIMIT/.test(text)) return "Transfer";
  if(/SALARY|CASHFOCUS|INTEREST|REFUND|CREDIT/.test(text)) return "Income";
  if(/SPAR|WOOLWORTHS|CHECKERS|SHOPRITE|PICK N PAY|FOOD LOVER/.test(text)) return "Groceries";
  if(/ENGEN|SHELL|\bBP\b|TOTAL|CALTEX|FUEL/.test(text)) return "Fuel";
  if(/KFC|KAUAI|RESTAURANT|BAR |HOTEL|UBER EATS|MR D/.test(text)) return "Dining & Entertainment";
  if(/ZARA|G-STAR|CLOTHING|FASHION|EDGARS|TRUWORTHS/.test(text)) return "Shopping";
  if(/OPENAI|CHATGPT|NETFLIX|APPLE|GOOGLE ONE/.test(text)) return "Subscriptions";
  if(/VIRGIN ACT|VITALITY|PHARMACY|CLICKS|DIS-CHEM/.test(text)) return "Health";
  if(/INSUR|OLD MUTUAL|ZESTLIFE|TRACKER/.test(text)) return "Insurance";
  if(/FEE|CHARGE/.test(text)) return "Banking";
  if(/TRAVEL|FLIGHT|AIRLINK|FLYSAFAIR/.test(text)) return "Travel";
  return "Other";
}
function sfKey(transaction){return [transaction.date,transaction.description,transaction.account,Number(transaction.amount).toFixed(2)].join("|");}
function sfImportRows(rows,account){
  const existing=new Set(data.transactions.map(sfKey));
  let added=0,duplicates=0,transfers=0;
  rows.forEach(row=>{
    const date=row["Value Date"]??row["Date"]??row["Transaction Date"];
    const description=sfText(row["Description"]??row["Narrative"]??row["Details"]);
    const type=sfText(row["Type"]);
    const raw=sfAmount(row["Amount"]??row["Debit"]??row["Credit"]);
    if(!date||!description||raw===0) return;
    const category=sfCategory(description,type);
    const transaction={
      date:sfDate(date),description,category,account,
      amount:Math.abs(raw),direction:raw<0?"expense":"income",isTransfer:category==="Transfer"
    };
    const key=sfKey(transaction);
    if(existing.has(key)){duplicates++;return;}
    existing.add(key);
    data.transactions.push(transaction);
    if(transaction.isTransfer) transfers++;
    added++;
  });
  save();render();
  return {added,duplicates,transfers};
}
function sfReadStatement(file,account){
  const status=document.getElementById("importStatus");
  status.textContent="Reading statement…";
  const reader=new FileReader();
  reader.onload=()=>{
    try{
      const csv=file.name.toLowerCase().endsWith(".csv");
      const workbook=XLSX.read(reader.result,{type:csv?"string":"array",cellDates:true});
      const rows=XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]],{defval:""});
      const result=sfImportRows(rows,account);
      status.textContent=`Imported ${result.added} transactions, identified ${result.transfers} transfers and skipped ${result.duplicates} duplicates.`;
    }catch(error){
      console.error(error);
      status.textContent="I could not read that file. Please use the bank's Excel or CSV transaction export.";
    }
  };
  file.name.toLowerCase().endsWith(".csv")?reader.readAsText(file):reader.readAsArrayBuffer(file);
}
document.getElementById("statementInput").addEventListener("change",event=>{
  const file=event.target.files[0];
  if(file) sfReadStatement(file,document.getElementById("statementAccount").value);
});