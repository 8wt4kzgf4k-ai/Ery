const apiKey = "f6e69ff791404a24b736a913676eca5e"; // Replace with your API key
const pairSelect = document.getElementById("pairSelect");
const tfSelect = document.getElementById("tfSelect");
const forecastBody = document.getElementById("forecastBody");
const countdownEl = document.getElementById("countdown");

let countdown = 60;

// Countdown timer
setInterval(() => {
    countdown--;
    if (countdown < 0) countdown = 60;
    let min = Math.floor(countdown/60).toString().padStart(2,'0');
    let sec = (countdown%60).toString().padStart(2,'0');
    countdownEl.textContent = `Next Candle in: ${min}:${sec}`;
}, 1000);

// EMA
function calculateEMA(prices, period=10) {
    let k = 2 / (period + 1);
    let emaArray = [prices[0]];
    for (let i = 1; i < prices.length; i++) {
        emaArray.push(prices[i]*k + emaArray[i-1]*(1-k));
    }
    return emaArray;
}

// SMA
function calculateSMA(prices, period=10) {
    let smaArray = [];
    for (let i=0;i<prices.length;i++){
        if(i<period-1){ smaArray.push(prices[i]); continue; }
        let sum = 0;
        for(let j=i-period+1;j<=i;j++) sum += prices[j];
        smaArray.push(sum/period);
    }
    return smaArray;
}

// RSI
function calculateRSI(prices, period=10) {
    let gains = 0, losses = 0;
    for (let i=1;i<=period;i++){
        let diff = prices[i] - prices[i-1];
        if(diff>0) gains+=diff; else losses+=Math.abs(diff);
    }
    let rs = gains / (losses || 1);
    let rsi = [100 - 100/(1+rs)];
    for(let i=period+1;i<prices.length;i++){
        let diff = prices[i] - prices[i-1];
        let gain = diff>0 ? diff : 0;
        let loss = diff<0 ? Math.abs(diff) : 0;
        gains = (gains*(period-1)+gain)/period;
        losses = (losses*(period-1)+loss)/period;
        rs = gains/(losses||1);
        rsi.push(100-100/(1+rs));
    }
    return rsi;
}

// ADX
function calculateADX(highs, lows, closes, period=10) {
    let trList = [], plusDM = [], minusDM = [];
    for (let i=1;i<closes.length;i++){
        const tr = Math.max(
            highs[i]-lows[i],
            Math.abs(highs[i]-closes[i-1]),
            Math.abs(lows[i]-closes[i-1])
        );
        trList.push(tr);
        const upMove = highs[i]-highs[i-1];
        const downMove = lows[i-1]-lows[i];
        plusDM.push((upMove>downMove && upMove>0)? upMove:0);
        minusDM.push((downMove>upMove && downMove>0)? downMove:0);
    }

    let atr=[], plusDI=[], minusDI=[], dx=[], adx=[];
    atr[0] = trList.slice(0,period).reduce((a,b)=>a+b,0)/period;
    plusDI[0] = (plusDM.slice(0,period).reduce((a,b)=>a+b,0)/atr[0])*100;
    minusDI[0] = (minusDM.slice(0,period).reduce((a,b)=>a+b,0)/atr[0])*100;
    dx[0] = Math.abs(plusDI[0]-minusDI[0])/(plusDI[0]+minusDI[0])*100;
    adx[0] = dx[0];

    for(let i=period;i<trList.length;i++){
        atr[i] = (atr[i-1]*(period-1)+trList[i])/period;
        plusDI[i] = ( (plusDI[i-1]*(period-1) + plusDM[i])/atr[i] )*100;
        minusDI[i] = ( (minusDI[i-1]*(period-1) + minusDM[i])/atr[i] )*100;
        dx[i] = Math.abs(plusDI[i]-minusDI[i])/(plusDI[i]+minusDI[i])*100;
        adx[i] = ( (adx[i-1]*(period-1)) + dx[i] ) / period;
    }
    return adx;
}

// Forecast next 3 candles
async function updateForecast() {
    const pair = pairSelect.value.replace("/","");
    const interval = tfSelect.value;
    try {
        const res = await fetch(`https://api.twelvedata.com/time_series?symbol=${pair}&interval=${interval}&outputsize=500&apikey=${apiKey}`);
        const data = await res.json();
        if(!data.values) return;

        const prices = data.values.map(c=>parseFloat(c.close)).reverse();
        const highs = data.values.map(c=>parseFloat(c.high)).reverse();
        const lows = data.values.map(c=>parseFloat(c.low)).reverse();

        const ema = calculateEMA(prices,10);
        const sma = calculateSMA(prices,10);
        const rsi = calculateRSI(prices,10);
        const adx = calculateADX(highs,lows,prices,10);

        const lastPrice = prices[prices.length-1];
        const lastEMA = ema[ema.length-1];
        const lastSMA = sma[sma.length-1];
        const lastRSI = rsi[rsi.length-1];
        const lastADX = adx[adx.length-1];
        const lastDiff = lastPrice - prices[prices.length-2];

        let probUp = 0.5;
        probUp += lastPrice>lastEMA ? 0.15 : -0.15;
        probUp += lastPrice>lastSMA ? 0.1 : -0.1;
        probUp += lastRSI<30 ? 0.1 : lastRSI>70 ? -0.1 : 0;
        probUp += lastDiff>0 ? 0.1 : -0.1;

        if(lastADX>25){
            probUp += lastPrice>lastEMA ? 0.1 : -0.1;
        }

        probUp = Math.min(Math.max(probUp,0),1);
        const probDown = 1-probUp;

        const forecast = [
            {higher: probUp, lower: probDown},
            {higher: probUp, lower: probDown},
            {higher: probUp, lower: probDown}
        ];

        forecastBody.innerHTML = "";
        forecast.forEach((c,i)=>{
            const row = document.createElement("tr");
            row.innerHTML = `<td>${i+1}</td><td>${c.higher.toFixed(2)}</td><td>${c.lower.toFixed(2)}</td>`;
            forecastBody.appendChild(row);
        });

    } catch(err){ console.error(err); }
}

pairSelect.addEventListener("change", ()=>{ countdown=60; updateForecast(); });
tfSelect.addEventListener("change", ()=>{ countdown=60; updateForecast(); });

updateForecast();
setInterval(updateForecast,15000);
