const fs = require('fs');
const path = require('path');
const papa  = require('papaparse');

const amazonListingsPath = path.resolve('All+Listings+Report+02-07-2020.txt');
const amazonListingsFile = fs.createReadStream(amazonListingsPath)

const rockBottomPricesPath = path.resolve('RockBottomPrices.csv');
const rockBottomPricesFile = fs.createReadStream(rockBottomPricesPath)

const profitToolPath = path.resolve('Harry test2.csv')
const profitToolFile = fs.createReadStream(profitToolPath)

const repricingRow = {
    sku:'', 
    price:'', 
    'minimum-seller-allowed-price':'', 
    'maximum-seller-allowed-price':'', 
    quantity: '', 
    'handling-time':'',
    'business-price':'', 
    'quantity-price-type': 'PERCENT', 
    'quantity-lower-bound1':'', 
    'quantity-price1':'', 
    'quantity-lower-bound2':'', 
    'quantity-price2':'', 
    'quantity-lower-bound3':'', 
    'quantity-price3':'', 
    'quantity-lower-bound4':'', 
    'quantity-price4':'', 
    'quantity-lower-bound5':'', 
    'quantity-price5':'', 
    'pricing_action':''
}

const multiSKUOrders = [];
const badSKUs = []
const newReprice = []


papa.parse(amazonListingsFile, {
    header: true,
    skipEmptyLines: true,
    complete: (x) => {
        const amazonListings = x.data;
        let amazonSKUs = {};
        amazonListings.forEach(item => amazonSKUs[item['seller-sku']] = item.price)
        console.log('AMAZON LISTINGS LOADED')

        papa.parse(rockBottomPricesFile, {
            header: true,
            skipEmptyLines: true,
            complete: (y) => {
               const rockBottomPrices = y.data;
               let rockBottomSKUs = {};
               rockBottomPrices.forEach(item => rockBottomSKUs[item.sku] = item.price)
               console.log('ROCK BOTTOM PRICES LOADED')

                papa.parse(profitToolFile, {
                    header: true,
                    skipEmptyLines: true,
                    complete: (w) => {
                        const profitData = w.data;
                        const losses = [];
                        
                        profitData.forEach(row => {
                            if (parseFloat(row['Profit (dollars)']) < 0) {
                                if(row['Order SKUs'].split('\n').length > 1) {
                                    multiSKUOrders.push(row)
                                } else {
                                    losses.push({
                                        sku: row['Order SKUs'],
                                        mainSku: row['Order SKUs'].split('-')[0],
                                        cost: parseFloat(row['Cost (dollars)']), 
                                        profit: parseFloat(row['Profit (dollars)']),
                                        distMult: (row['Order SKUs'].split('-')[0].slice(-1)) === '*' ? 1.1 : 1.15
                                    })
                                }
                            }
                        })
                        console.log('LOSSES COUNTED', losses.length)
                        losses.forEach(loss => {
                            if (rockBottomSKUs[loss.sku]) {
                                console.log('SKU found in Rock Bottom Prices:', loss.sku)
                                let rockBottomSKUsToReprice = rockBottomPrices.filter(e => e.sku.split('-')[0] === loss.mainSku)
                                rockBottomSKUsToReprice.forEach(f => {
                                    let newRow = {
                                        ...repricingRow,
                                        sku: f.sku,
                                        price: (loss.cost * 1.14).toFixed(2),
                                        'minimum-seller-allowed-price': (loss.cost * 1.14).toFixed(2),
                                        'maximum-seller-allowed-price': (loss.cost * 1.14 * loss.distMult).toFixed(2),
                                        'business-price': (loss.cost * 1.14).toFixed(2),
                                    }
                                    newReprice.push(newRow)
                                })
                                console.log('Number of SKUs added from Rock Bottom Prices:', rockBottomSKUsToReprice.length)
                                let amazonSKUsToReprice = amazonListings.filter(e => e['seller-sku'].split('-')[0] === loss.mainSku)
                                amazonSKUsToReprice.forEach(f => {
                                    let newRow = {
                                        ...repricingRow,
                                        sku: f['seller-sku'],
                                        price: (loss.cost * 1.14).toFixed(2),
                                        'minimum-seller-allowed-price': (loss.cost * 1.14).toFixed(2),
                                        'maximum-seller-allowed-price': (loss.cost * 1.14 * loss.distMult).toFixed(2),
                                        'business-price': (loss.cost * 1.14).toFixed(2),
                                    }
                                    newReprice.push(newRow)
                                })
                                console.log('Additional SKUs added from Amazon Listings:', amazonSKUsToReprice.length)
                            } else if (amazonSKUs[loss.sku]) {
                                console.log('SKU found only in Amazon Listings:', loss.sku)
                                let amazonSKUsToReprice = amazonListings.filter(e => e['seller-sku'].split('-')[0] === loss.mainSku)
                                console.log('Number of SKUs added from Amazon Listings:', amazonSKUsToReprice.length)
                                amazonSKUsToReprice.forEach(f => {
                                    let newRow = {
                                        ...repricingRow,
                                        sku: f['seller-sku'],
                                        price: (loss.cost * 1.14).toFixed(2),
                                        'minimum-seller-allowed-price': (loss.cost * 1.14).toFixed(2),
                                        'maximum-seller-allowed-price': (loss.cost * 1.14 * loss.distMult).toFixed(2),
                                        'business-price': (loss.cost * 1.14).toFixed(2),
                                    }
                                    newReprice.push(newRow)
                                })
                            } else {
                                badSKUs.push(loss)
                            }
                        })
                        const csvData = papa.unparse(newReprice, {delimiter: "\t"});
                        fs.writeFile('BusinessPricingTest(2-28-20).tsv', csvData, (err) => {
                            if(err) console.log(err);
                        })

                        if (multiSKUOrders.length > 0) {
                            const multiSKUOrdersData = papa.unparse(multiSKUOrders, {delimiter: "\t"});
                            fs.writeFile('MultiSKUOrders', multiSKUOrdersData, (err) => {
                                if(err) console.log(err);
                            })
                        }
                        if (badSKUs.length > 0) {
                            const badSKUsData = papa.unparse(badSKUs, {delimiter: "\t"});
                            fs.writeFile('BadSKUs', badSKUsData, (err) => {
                                if(err) console.log(err);
                            })
                        }

                        console.log('SUCCESS!')
                        console.log("New Rows to Reprice:", newReprice.length)
                        console.log("Multi Order SKUs:", multiSKUOrders.length)
                        console.log("Bad SKUs:", badSKUs.length)
                    }
                })
            }
        })
    }
})