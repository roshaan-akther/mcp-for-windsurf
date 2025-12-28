import { z } from "zod";
// Exchange Rate API Tool
const exchangeRatesTool = {
    name: "exchange_rates",
    description: "Get current exchange rates from exchangerate-api.com",
    schema: {
        base: z.string().default('USD').describe("Base currency (e.g., USD, EUR, GBP)"),
        target: z.string().optional().describe("Target currency (e.g., EUR, GBP) - if not provided, returns all rates")
    },
    handler: async ({ base, target }) => {
        try {
            const baseUrl = 'https://api.exchangerate-api.com/v4/latest';
            const response = await fetch(`${baseUrl}/${base.toUpperCase()}`);
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            const data = await response.json();
            // If target specified, return only that rate
            if (target) {
                const targetUpper = target.toUpperCase();
                const rate = data.rates[targetUpper];
                if (!rate) {
                    return {
                        content: [
                            {
                                type: "text",
                                text: `Currency "${target}" not found. Available currencies: ${Object.keys(data.rates).join(', ')}`
                            }
                        ]
                    };
                }
                return {
                    content: [
                        {
                            type: "text",
                            text: JSON.stringify({
                                source: "ExchangeRate-API.com",
                                base_currency: data.base,
                                target_currency: targetUpper,
                                exchange_rate: rate,
                                date: data.date,
                                fetched_at: new Date().toISOString()
                            }, null, 2)
                        }
                    ]
                };
            }
            return {
                content: [
                    {
                        type: "text",
                        text: JSON.stringify({
                            source: "ExchangeRate-API.com",
                            base_currency: data.base,
                            total_rates: Object.keys(data.rates).length,
                            rates: data.rates,
                            date: data.date,
                            fetched_at: new Date().toISOString()
                        }, null, 2)
                    }
                ]
            };
        }
        catch (error) {
            return {
                content: [
                    {
                        type: "text",
                        text: `Error fetching exchange rates: ${error instanceof Error ? error.message : 'Unknown error'}`
                    }
                ]
            };
        }
    }
};
// CoinGecko Cryptocurrency Prices Tool
const coinGeckoPricesTool = {
    name: "coingecko_prices",
    description: "Get cryptocurrency prices from CoinGecko API",
    schema: {
        coins: z.string().default('bitcoin,ethereum,dogecoin').describe("Comma-separated list of coin IDs"),
        vs_currency: z.string().default('usd').describe("Target currency (e.g., usd, eur, gbp)"),
        include_market_cap: z.boolean().default(true).describe("Include market cap data"),
        include_24hr_change: z.boolean().default(true).describe("Include 24h change data")
    },
    handler: async ({ coins, vs_currency, include_market_cap, include_24hr_change }) => {
        try {
            const baseUrl = 'https://api.coingecko.com/api/v3/simple/price';
            const params = new URLSearchParams({
                ids: coins,
                vs_currencies: vs_currency,
                include_market_cap: include_market_cap.toString(),
                include_24hr_change: include_24hr_change.toString()
            });
            const response = await fetch(`${baseUrl}?${params}`);
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            const data = await response.json();
            return {
                content: [
                    {
                        type: "text",
                        text: JSON.stringify({
                            source: "CoinGecko API",
                            target_currency: vs_currency.toUpperCase(),
                            coins_requested: coins.split(',').length,
                            coins_returned: Object.keys(data).length,
                            prices: data,
                            fetched_at: new Date().toISOString()
                        }, null, 2)
                    }
                ]
            };
        }
        catch (error) {
            return {
                content: [
                    {
                        type: "text",
                        text: `Error fetching crypto prices: ${error instanceof Error ? error.message : 'Unknown error'}`
                    }
                ]
            };
        }
    }
};
// CoinGecko Trending Coins Tool
const coinGeckoTrendingTool = {
    name: "coingecko_trending",
    description: "Get trending cryptocurrencies from CoinGecko",
    schema: {},
    handler: async () => {
        try {
            const response = await fetch('https://api.coingecko.com/api/v3/search/trending');
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            const data = await response.json();
            return {
                content: [
                    {
                        type: "text",
                        text: JSON.stringify({
                            source: "CoinGecko API",
                            trending_coins: data.coins.map((coin) => ({
                                rank: coin.item.market_cap_rank,
                                name: coin.item.name,
                                symbol: coin.item.symbol,
                                price_btc: coin.item.price_btc,
                                market_cap_rank: coin.item.market_cap_rank,
                                id: coin.item.id
                            })),
                            fetched_at: new Date().toISOString()
                        }, null, 2)
                    }
                ]
            };
        }
        catch (error) {
            return {
                content: [
                    {
                        type: "text",
                        text: `Error fetching trending coins: ${error instanceof Error ? error.message : 'Unknown error'}`
                    }
                ]
            };
        }
    }
};
// Alpha Vantage Stock Price Tool
const alphaVantageStockTool = {
    name: "alphavantage_stock",
    description: "Get stock prices from Alpha Vantage API",
    schema: {
        symbol: z.string().min(1).describe("Stock symbol (e.g., AAPL, GOOGL, MSFT)"),
        api_key: z.string().optional().describe("Alpha Vantage API key (required for real data)")
    },
    handler: async ({ symbol, api_key }) => {
        try {
            if (!api_key) {
                return {
                    content: [
                        {
                            type: "text",
                            text: "Alpha Vantage API key required. Get a free key from https://www.alphavantage.co/support/#api-key"
                        }
                    ]
                };
            }
            const baseUrl = 'https://www.alphavantage.co/query';
            const params = new URLSearchParams({
                function: 'GLOBAL_QUOTE',
                symbol: symbol.toUpperCase(),
                apikey: api_key
            });
            const response = await fetch(`${baseUrl}?${params}`);
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            const data = await response.json();
            if (data['Error Message']) {
                return {
                    content: [
                        {
                            type: "text",
                            text: `Error: ${data['Error Message']}`
                        }
                    ]
                };
            }
            if (data['Note']) {
                return {
                    content: [
                        {
                            type: "text",
                            text: `API limit reached: ${data['Note']}`
                        }
                    ]
                };
            }
            const quote = data['Global Quote'];
            return {
                content: [
                    {
                        type: "text",
                        text: JSON.stringify({
                            source: "Alpha Vantage API",
                            symbol: quote['01. symbol'],
                            price: parseFloat(quote['05. price']),
                            change: parseFloat(quote['09. change']),
                            change_percent: quote['10. change percent'],
                            volume: parseInt(quote['06. volume']),
                            last_updated: quote['07. latest trading day'],
                            open: parseFloat(quote['02. open']),
                            high: parseFloat(quote['03. high']),
                            low: parseFloat(quote['04. low']),
                            close: parseFloat(quote['08. previous close']),
                            fetched_at: new Date().toISOString()
                        }, null, 2)
                    }
                ]
            };
        }
        catch (error) {
            return {
                content: [
                    {
                        type: "text",
                        text: `Error fetching stock data: ${error instanceof Error ? error.message : 'Unknown error'}`
                    }
                ]
            };
        }
    }
};
// Financial Modeling Prep Stock Tool
const fmpStockTool = {
    name: "fmp_stock",
    description: "Get stock prices from Financial Modeling Prep API",
    schema: {
        symbol: z.string().min(1).describe("Stock symbol (e.g., AAPL, GOOGL, MSFT)"),
        api_key: z.string().optional().describe("FMP API key (optional, uses demo key)")
    },
    handler: async ({ symbol, api_key }) => {
        try {
            // Use demo API key if none provided
            const apiKey = api_key || 'demo';
            const baseUrl = `https://financialmodelingprep.com/api/v3/quote/${symbol.toUpperCase()}`;
            const params = new URLSearchParams({
                apikey: apiKey
            });
            const response = await fetch(`${baseUrl}?${params}`);
            if (!response.ok) {
                if (response.status === 429) {
                    return {
                        content: [
                            {
                                type: "text",
                                text: "API limit reached. Please provide your own FMP API key from https://site.financialmodelingprep.com/developer/docs"
                            }
                        ]
                    };
                }
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            const data = await response.json();
            if (data.length === 0) {
                return {
                    content: [
                        {
                            type: "text",
                            text: `Stock symbol "${symbol}" not found`
                        }
                    ]
                };
            }
            const stock = data[0];
            return {
                content: [
                    {
                        type: "text",
                        text: JSON.stringify({
                            source: "Financial Modeling Prep API",
                            symbol: stock.symbol,
                            name: stock.name,
                            price: stock.price,
                            change: stock.change,
                            change_percent: stock.changesPercentage,
                            volume: stock.volume,
                            market_cap: stock.marketCap,
                            year_high: stock.yearHigh,
                            year_low: stock.yearLow,
                            day_high: stock.dayHigh,
                            day_low: stock.dayLow,
                            previous_close: stock.previousClose,
                            fetched_at: new Date().toISOString()
                        }, null, 2)
                    }
                ]
            };
        }
        catch (error) {
            return {
                content: [
                    {
                        type: "text",
                        text: `Error fetching stock data: ${error instanceof Error ? error.message : 'Unknown error'}`
                    }
                ]
            };
        }
    }
};
export const financeApisAdapter = {
    name: "finance-apis",
    description: "Financial data APIs including stocks, crypto, and exchange rates",
    tools: [
        exchangeRatesTool,
        coinGeckoPricesTool,
        coinGeckoTrendingTool,
        alphaVantageStockTool,
        fmpStockTool
    ]
};
