const apiKey = "f6e69ff791404a24b736a913676eca5e"; // Replace with your API key
const pairs = ["EUR/USD","GBP/USD","USD/JPY","USD/CHF","USD/CAD","AUD/USD","NZD/USD"];
const forecastBody = document.getElementById("forecastBody");
const countdownEl = document.getElementById("countdown");

let countdown = 300; // 5 minutes

// Countdown timer
setInterval(() => {
    countdown--;
    if (countdown < 0) countdown = 300;
    let min = Math.floor(countdown/60).toString().padStart(2,'0');
    let sec = (countdown%60).toString().padStart(2,'0');
    countdownEl.textContent = `Next Recommendation in: ${min}:${sec}`;
}, 1000);

// EMA
function calculateEMA(prices, period=10){
    let k = 2/(period+1);
    let ema = [prices[0]];
    for(let i=1;i<prices.length;i++){
        ema.push(prices[i]*k + ema[i-1]*(1-k));
    }
    return ema;
}

// SMA
function calculateSMA(prices, period=10){
    let sma=[];
    for(let i=0;i<prices.length;i++){
        if(i<period-1){ sma.push(prices[i]); continue; }
        let sum=0;
        for(let j=i-period+1;j<=i;j++) sum+=prices[j];
        sma.push(sum/period);
    }
    return sma;
}

// RSI
function calculateRSI(prices, period=10){
    let gains=0, losses=0;
    for(let i=1;i<=period;i++){
        let diff = prices[i]-prices[i-1];
        if(diff>0) gains+=diff; else losses+=Math.abs(diff);
    }
    let rs=gains/(losses||1);
    let rsi = [100-100/(1+rs)];
    for(let i=period+1;i<prices.length;i++){
        let diff = prices[i]-prices[i-1];
        let gain = diff>0?diff:0;
        let loss = diff<0?Math.abs(diff):0;
        gains = (gains*(period-1)+gain)/period;
        losses = (losses*(period-1)+loss)/period;
        rs = gains/(losses||1);
        rsi.push(100-100/(1+rs));
    }
    return rsi;
}

// Forecast next 3 candles
async function updateForecast(){
    let highestProb = 0;
    let bestCell = null;
    forecastBody.innerHTML = "";

    for(let pair of pairs){
        try{
            const res = await fetch(`https://api.twelvedata.com/time_series?symbol=${pair.replace("/","")}&interval=1min&outputsize=50&apikey=${apiKey}`);
            const data = await res.json();
            if(!data.values) continue;

            const prices = data.values.map(c=>parseFloat(c.close)).reverse();
            const ema = calculateEMA(prices,10);
            const sma = calculateSMA(prices,10);
            const rsi = calculateRSI(prices,10);
            const lastPrice = prices[prices.length-1];
            const lastEMA = ema[ema.length-1];
            const lastSMA = sma[sma.length-1];
            const lastRSI = rsi[rsi.length-1];

            // Forecast probabilities for next 3 candles
            let probs = [];
            for(let i=0;i<3;i++){
                let probUp = 0.5;
                probUp += lastPrice>lastEMA?0.15:-0.15;
                probUp += lastPrice>lastSMA?0.1:-0.1;
                probUp += lastRSI<30?0.1:lastRSI>70?-0.1:0;
                probUp = Math.min(Math.max(probUp,0),1);
                probs.push(probUp);
            }

            const probDowns = probs.map(p=>1-p);
            const recommendations = probs.map((p,i)=>p>probDowns[i]?"Up":"Down");

            // Build row
            const tr = document.createElement("tr");
            tr.innerHTML = `<td>${pair}</td>
                <td>${recommendations[0]} ${probs[0].toFixed(2)}</td>
                <td>${recommendations[1]} ${probs[1].toFixed(2)}</td>
                <td>${recommendations[2]} ${probs[2].toFixed(2)}</td>
                <td>${recommendations[0]}</td>`;
            forecastBody.appendChild(tr);

            // Highlight the highest probability candle
            for(let i=0;i<3;i++){
                if(probs[i]>highestProb){
                    highestProb=probs[i];
                    if(bestCell) bestCell.classList.remove("best");
                    bestCell = tr.children[i+1];
                    bestCell.classList.add("best");
                }
            }

        }catch(e){ console.error(e);}
    }
}

updateForecast();
setInterval(updateForecast, 300000); // every 5 minutes
