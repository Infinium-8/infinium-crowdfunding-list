const chalk = require('chalk');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const express = require('express');
const app = express();

const coinsBasic = 'https://raw.githubusercontent.com/Infinium-8/infinium-crowdfunding-json/refs/heads/master/infinium-crowdfunding.json';

async function fetchCoins() {
    try {
        const response = await axios.get(coinsBasic);
        return response.data.coins;
    } catch (error) {
        console.error('Error fetching coins from GitHub:', error);
        return [];
    }
}

async function callJsonRpc(url, rpcMethod, params, method) {
    try {
        const response = await axios({
            method,
            url,
            headers: { 'Content-Type': 'application/json' },
            data: {
                jsonrpc: '2.0',
                method: rpcMethod,
                params: params,
                id: 1
            }
        });
        return response.data.result;
    } catch (error) {
        console.error(`Call error ${method} to ${url}:`, error.message);
        return null;
    }
}

async function callRpcForCoins(coin) {
    const { url, port, rpcMethod } = coin;
    const fullUrl = `http://${url}:${port}/json_rpc`;

    let rpcMethodType = (rpcMethod === "getbalance") ? "GET" : "POST";

    console.log(chalk.blue(`Calling to ${rpcMethod} in ${fullUrl} using the method ${rpcMethodType}...`));

    if (coin.name === 'Monero'){
         result = await callJsonRpc(fullUrl, rpcMethod, {"address_indices":[0,1]}, rpcMethodType);
    } else {
         result = await callJsonRpc(fullUrl, rpcMethod, [], rpcMethodType);
    }
 
    if (result !== null ) {
        console.log(chalk.green(`Result for ${rpcMethod}:`), result);
        return result   
    } else {
        console.log(chalk.red(`Error calling ${rpcMethod} in ${fullUrl}.`));
        return null;
    }
}

async function updateCrowdfundingList() {
    const coins = await fetchCoins();
    const updateCrowdfunding = [];

    for (const coin of coins) {
        console.log(`Updating information for the currency: ${coin.name}`);
        const info = await callRpcForCoins(coin);
        const addressInfo = await callJsonRpc(`http://${coin.url}:${coin.port}/json_rpc`, "getaddress", [], "GET");              
                
        if (info && info.per_subaddress) {
            updateCrowdfunding.push({
                name: coin.name,
                address: info.per_subaddress[0].address,
                balance: (info.balance / 10**coin.decimal).toFixed(2)
            });
        }
        else if (info && !info.per_subaddress){
            updateCrowdfunding.push({
                name: coin.name,
                address: addressInfo.address,
                balance: (info.balance / 10**coin.decimal).toFixed(2)
            });
        } else {
            console.log(chalk.red(`Error getting information for currency: ${coin.name}`));
        }
    }

    fs.writeFileSync('public/coins.json', JSON.stringify({ coins: updateCrowdfunding }, null, 2), 'utf8');
    console.log(chalk.green.bold('Crowdfunding list updated successfully.'));
}

updateCrowdfundingList()
setInterval(updateCrowdfundingList, 5 * 60 * 1000);

app.get('/coins.json', (req, res) => {
    res.redirect(301, '/crowdfunding/balances/');
});

app.get('/crowdfunding/balances/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'coins.json'));
});

app.use(express.static('public'));

const PORT = process.env.PORT || 2345;

app.listen(PORT, () => {
    console.log(chalk.blue.bold(`Server running on port ${PORT}`));
});