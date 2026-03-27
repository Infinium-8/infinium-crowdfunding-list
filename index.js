const chalk = require('chalk');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const express = require('express');
const app = express();

app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
    next();
});


const coinsBasic = 'https://raw.githubusercontent.com/Infinium-8/infinium-crowdfunding-json/refs/heads/master/infinium-crowdfunding.json';

const addressBTC = 'bc1q2e9kxhpxg59a573rkk5wk66n5y493eras9mq3d';
const blockstreamApi = 'https://blockstream.info/api/address/'+ addressBTC;
const addressLTC = 'ltc1q40j7rltqxfhja687gh0qmaa3p7pw4glps4sep5';
const litecoinspaceApi = 'https://litecoinspace.org/api/address/' + addressLTC;
const addressDOGE = 'DF4EbEJnvdoq3nPhshG3zEFS47QBJ54B3f';
const blockcypherdogeApi = 'https://api.blockcypher.com/v1/doge/main/addrs/' + addressDOGE;

async function fetchBlockstreamBTC() {
   try {
	const response = await axios.get(blockstreamApi);
	return response.data;
   } catch (error) {
       console.error('API Blockstream Down');
       return  [];
   }
}

async function fetchlitecoinspaceLTC() {
    try {
     const response = await axios.get(litecoinspaceApi);
     return response.data;
    } catch (error) {
        console.error('API Litecoinspace Down');
        return  [];
    }
}

async function fetchblockcypherDOGE() {
    try {
     const response = await axios.get(blockcypherdogeApi);
     return response.data;
    } catch (error) {
        console.error('API Blockcypher Down');
        return  [];
    }
}

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
        console.log(chalk.bold.green(`Updating information for the currency: ${coin.name}`));
        if (coin.walletType==='out') {
            if (coin.name === 'Bitcoin') {
            const blockstreamBTC = await fetchBlockstreamBTC();
            if (blockstreamBTC && blockstreamBTC.chain_stats) {
                const balance = blockstreamBTC.chain_stats.funded_txo_sum - blockstreamBTC.chain_stats.spent_txo_sum;
                console.log(chalk.bold.magenta(`${coin.name} Balance: ` + (balance / 10 ** coin.decimal).toFixed(8)));
                console.log(chalk.bold.blue(`${coin.name} Address: ${blockstreamBTC.address}`));
		        updateCrowdfunding.push({
                    name: coin.name,
                    address: blockstreamBTC.address,
                    balance: (balance / 10 ** coin.decimal).toFixed(8),
                    image: coin.image
                });
            }
            } else if (coin.name === 'Litecoin') {
                const litecoinspaceLTC = await fetchlitecoinspaceLTC();
                if (litecoinspaceLTC && litecoinspaceLTC.chain_stats) {
                    const balance = litecoinspaceLTC.chain_stats.funded_txo_sum - litecoinspaceLTC.chain_stats.spent_txo_sum;
                    console.log(chalk.bold.magenta(`${coin.name} Balance: ` + (balance / 10 ** coin.decimal).toFixed(8)));
                    console.log(chalk.bold.blue(`${coin.name} Address: ${litecoinspaceLTC.address}`));
                    updateCrowdfunding.push({
                        name: coin.name,
                        address: litecoinspaceLTC.address,
                        balance: (balance / 10 ** coin.decimal).toFixed(8),
                        image: coin.image
                    });
                }
            } else if (coin.name === 'Dogecoin') {
                const blockcypherDOGE = await fetchblockcypherDOGE();
                if (blockcypherDOGE) {
                    const balance = blockcypherDOGE.total_received - blockcypherDOGE.total_sent;
                    console.log(chalk.bold.magenta(`${coin.name} Balance: ` + (balance / 10 ** coin.decimal).toFixed(8)));
                    console.log(chalk.bold.blue(`${coin.name} Address: ${blockcypherDOGE.address}`));
                    updateCrowdfunding.push({
                        name: coin.name,
                        address: blockcypherDOGE.address,
                        balance: (balance / 10 ** coin.decimal).toFixed(8),
                        image: coin.image
                    });
                }
            } else {
                console.log(chalk.red(`Error getting information for currency: ${coin.name}`));
            }
        }
        if (coin.walletType==='in') {
            var info = await callRpcForCoins(coin);
            const addressInfo = await callJsonRpc(`http://${coin.url}:${coin.port}/json_rpc`, "getaddress", [], "GET");
            
            if (info && info.per_subaddress ) {
                updateCrowdfunding.push({
                    name: coin.name,
                    address: info.per_subaddress[0].address,
                    balance: (info.balance / 10**coin.decimal).toFixed(2),
                    image: coin.image
                });
            } else if (info && !info.per_subaddress ){
                updateCrowdfunding.push({
                    name: coin.name,
                    address: addressInfo.address,
                    balance: (info.balance / 10**coin.decimal).toFixed(2),
                    image: coin.image
                });
            } else {
                console.log(chalk.red(`Error getting information for currency: ${coin.name}`));
            }
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
