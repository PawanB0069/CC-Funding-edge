import http from 'node:http';
import path from 'node:path';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT || 3000);
const CACHE_MS = Number(process.env.CACHE_MS || 10000);
let cache = { at: 0, payload: null };
const mime = { '.html':'text/html; charset=utf-8', '.css':'text/css; charset=utf-8', '.js':'text/javascript; charset=utf-8', '.json':'application/json; charset=utf-8', '.svg':'image/svg+xml', '.png':'image/png', '.ico':'image/x-icon' };

function send(res, status, body, type='application/json; charset=utf-8') {
  res.writeHead(status, { 'content-type': type, 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' });
  res.end(type.startsWith('application/json') ? JSON.stringify(body) : body);
}
async function fetchJson(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 9000);
  try {
    const response = await fetch(url, { signal: controller.signal, headers: { 'user-agent': 'FundingEdge/1.0 public-market-data' } });
    if (!response.ok) throw new Error(`Upstream HTTP ${response.status}`);
    return await response.json();
  } finally { clearTimeout(timer); }
}
async function getBinance() {
  const [premium, fundingInfo, ticker] = await Promise.all([
    fetchJson('https://fapi.binance.com/fapi/v1/premiumIndex'),
    fetchJson('https://fapi.binance.com/fapi/v1/fundingInfo').catch(() => []),
    fetchJson('https://fapi.binance.com/fapi/v1/ticker/24hr')
  ]);
  const intervalMap = new Map((fundingInfo || []).map(x => [x.symbol, Number(x.fundingIntervalHours || 8)]));
  const tickerMap = new Map((ticker || []).map(x => [x.symbol, x]));
  return (premium || []).filter(x => x.symbol?.endsWith('USDT')).map(x => {
    const t = tickerMap.get(x.symbol) || {}, intervalHours = intervalMap.get(x.symbol) || 8, rate = Number(x.lastFundingRate);
    return { exchange:'Binance', symbol:x.symbol, asset:x.symbol.replace(/USDT$/, ''), fundingRate:rate, intervalHours,
      hourlyRate:rate/intervalHours, dailyRate:rate*24/intervalHours, annualizedRate:rate*24/intervalHours*365,
      markPrice:Number(x.markPrice), indexPrice:Number(x.indexPrice), nextFundingTime:Number(x.nextFundingTime),
      volume24h:Number(t.quoteVolume||0), priceChange24h:Number(t.priceChangePercent||0), openInterest:null, sourceUpdatedAt:Number(x.time||Date.now()) };
  });
}
async function getBybit() {
  const [tickerData, instrumentData] = await Promise.all([
    fetchJson('https://api.bybit.com/v5/market/tickers?category=linear'),
    fetchJson('https://api.bybit.com/v5/market/instruments-info?category=linear&limit=1000')
  ]);
  if (tickerData.retCode !== 0) throw new Error(`Bybit: ${tickerData.retMsg}`);
  const intervalMap = new Map((instrumentData.result?.list||[]).map(x=>[x.symbol,Number(x.fundingInterval||480)/60]));
  return (tickerData.result?.list||[]).filter(x=>x.symbol?.endsWith('USDT')).map(x=>{
    const intervalHours=intervalMap.get(x.symbol)||8, rate=Number(x.fundingRate||0);
    return { exchange:'Bybit', symbol:x.symbol, asset:x.symbol.replace(/USDT$/,''), fundingRate:rate, intervalHours,
      hourlyRate:rate/intervalHours, dailyRate:rate*24/intervalHours, annualizedRate:rate*24/intervalHours*365,
      markPrice:Number(x.markPrice||0), indexPrice:Number(x.indexPrice||0), nextFundingTime:Number(x.nextFundingTime||0),
      volume24h:Number(x.turnover24h||0), priceChange24h:Number(x.price24hPcnt||0)*100,
      openInterest:Number(x.openInterestValue||0), sourceUpdatedAt:Date.now() };
  });
}
async function loadMarketData(force=false) {
  if(!force&&cache.payload&&Date.now()-cache.at<CACHE_MS)return cache.payload;
  const results=await Promise.allSettled([getBinance(),getBybit()]), exchanges={},rows=[];
  results.forEach((r,i)=>{const name=i===0?'Binance':'Bybit';if(r.status==='fulfilled'){exchanges[name]={status:'live',count:r.value.length};rows.push(...r.value);}else exchanges[name]={status:'error',message:String(r.reason?.message||r.reason)};});
  if(!rows.length)throw new Error('All exchange data sources are unavailable. Please retry shortly.');
  const grouped=new Map();for(const row of rows){if(!grouped.has(row.asset))grouped.set(row.asset,[]);grouped.get(row.asset).push(row);}
  const opportunities=[];
  for(const [asset,list] of grouped){if(list.length<2)continue;list.sort((a,b)=>b.dailyRate-a.dailyRate);const high=list[0],low=list.at(-1),spread=high.dailyRate-low.dailyRate;
    if(high.exchange!==low.exchange&&spread>0)opportunities.push({asset,symbol:`${asset}USDT`,shortExchange:high.exchange,longExchange:low.exchange,shortDailyRate:high.dailyRate,longDailyRate:low.dailyRate,spreadDailyRate:spread,estimatedDailyPct:spread*100,estimatedAnnualPct:spread*365*100,shortFundingIntervalHours:high.intervalHours,longFundingIntervalHours:low.intervalHours,shortMarkPrice:high.markPrice,longMarkPrice:low.markPrice,minVolume24h:Math.min(high.volume24h,low.volume24h)});
  }
  opportunities.sort((a,b)=>b.spreadDailyRate-a.spreadDailyRate);
  const payload={updatedAt:Date.now(),exchanges,rows,opportunities:opportunities.slice(0,100),note:'Funding rates are snapshots/estimates. Actual settlements, intervals, fees, basis, slippage, liquidity and margin risks differ by exchange.'};cache={at:Date.now(),payload};return payload;
}
async function route(req,res){
  const url=new URL(req.url,'http://localhost');
  if(req.method!=='GET')return send(res,405,{error:'Method not allowed'});
  if(url.pathname==='/api/health')return send(res,200,{ok:true,name:'FundingEdge API',time:Date.now()});
  if(url.pathname==='/api/market'){
    try{return send(res,200,await loadMarketData(url.searchParams.get('refresh')==='1'));}
    catch(error){return send(res,503,{error:error.message,updatedAt:cache.at||null});}
  }
  const history=url.pathname.match(/^\/api\/history\/(binance|bybit)\/([A-Z0-9]+)$/i);
  if(history){const exchange=history[1].toLowerCase(),symbol=history[2].toUpperCase();try{
    if(exchange==='binance'){const d=await fetchJson(`https://fapi.binance.com/fapi/v1/fundingRate?symbol=${encodeURIComponent(symbol)}&limit=100`);return send(res,200,d.map(x=>({time:Number(x.fundingTime),rate:Number(x.fundingRate)})));}
    const d=await fetchJson(`https://api.bybit.com/v5/market/funding/history?category=linear&symbol=${encodeURIComponent(symbol)}&limit=100`);if(d.retCode!==0)throw new Error(d.retMsg);return send(res,200,(d.result?.list||[]).map(x=>({time:Number(x.fundingRateTimestamp),rate:Number(x.fundingRate)})).reverse());
  }catch(error){return send(res,502,{error:error.message});}}
  let filePath=path.join(__dirname,'public',url.pathname==='/'?'index.html':decodeURIComponent(url.pathname).replace(/^\/+/,''));
  const publicRoot=path.join(__dirname,'public');
  const relative=path.relative(publicRoot,filePath);
  if(relative.startsWith('..')||path.isAbsolute(relative))return send(res,403,{error:'Forbidden'});
  try{const data=await readFile(filePath);return send(res,200,data,mime[path.extname(filePath)]||'application/octet-stream');}
  catch{return send(res,404,{error:'Not found'});}
}
http.createServer((req,res)=>{route(req,res).catch(e=>send(res,500,{error:'Internal server error'}));}).listen(PORT,()=>console.log(`FundingEdge running on http://localhost:${PORT}`));
