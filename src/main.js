const papa  = require('papaparse');
const path = require('path');
const FileSaver = require('file-saver');

// const amazonListingsPath = path.resolve('All+Listings+Report+02-07-2020.txt');
// const rockBottomPricesPath = path.resolve('RockBottomPrices.csv');

const amazonListingsFile = require('./AllAmazonListings.js');
const rockBottomPricesFile = require('./RockBottomPrices.js');
const reader = new FileReader();

const repricingRow = {
  sku:'', 
  price:'', 
  'minimum-seller-allowed-price':'', 
  'maximum-seller-allowed-price':'', 
  quantity: '', 
  'handling-time':'',
  'business-price':'', 
  'quantity-price-type': 'PERCENT', 
  'quantity-lower-bound1':2, 
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
const badSKUs = [];
const newReprice = [];

let profitToolFile;

document.addEventListener('DOMContentLoaded', function(){
  alert('Ready for Magic!')
});

document.getElementById('file1').addEventListener('change', function (e) {
    var files = e.target.files;
    reader.readAsText(files[0]);
    reader.onload = function(){
      profitToolFile = reader.result;
      console.log('file uploaded');
    };
  }, false);
  // reader.readAsText(amazonListingsPath);
  //     reader.onload = function(){
  //       amazonListingsFile = reader.result;
  //       console.log('amazon listings loaded');
  //       reader.readAsText(rockBottomPricesPath);
  //       reader.onload = function(){
  //         rockBottomPricesFile = reader.result;
  //         console.log('rock bottom prices loaded');
          
  module.exports = function reprice() {
    if(!profitToolFile) alert('File is not yet done loading!')
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
                          let price = (loss.cost * 1.14).toFixed(2)
                          let newRow = {
                            ...repricingRow,
                            sku: f.sku,
                            price,
                            'minimum-seller-allowed-price': (loss.cost * 1.14).toFixed(2),
                            'maximum-seller-allowed-price': (loss.cost * 1.14 * loss.distMult).toFixed(2),
                            'business-price':price,
                            'quantity-price1':(price < 70) ? 5 : 1, 
                            'quantity-lower-bound2':(price < 70) ? 3 : '', 
                            'quantity-price2':(price < 70) ? 6 : '', 
                            'quantity-lower-bound3':(price < 70) ? 4 : '', 
                            'quantity-price3':(price < 70) ? 7 : '', 
                            'quantity-lower-bound4':(price < 70) ? 5 : '', 
                            'quantity-price4':(price < 70) ? 9 : '', 
                            'quantity-lower-bound5':(price < 70) ? 6 : '', 
                            'quantity-price5':(price < 70) ? 10 : '', 
                          }
                          newReprice.push(newRow)
                        })
                        console.log('Number of SKUs added from Rock Bottom Prices:', rockBottomSKUsToReprice.length)
                        let additionalAmazonSKUs = amazonListings.filter(e => {
                          if (!rockBottomSKUsToReprice.find(f => f.sku === e['seller-sku'])) {
                            return e['seller-sku'].split('-')[0] === loss.mainSku
                          } else {
                            return false
                          }
                        })
                        additionalAmazonSKUs.forEach(f => {
                          let price = (loss.cost * 1.14).toFixed(2)
                          let newRow = {
                            ...repricingRow,
                            sku: f['seller-sku'],
                            price: (loss.cost * 1.14 * loss.distMult).toFixed(2),
                            'minimum-seller-allowed-price': (loss.cost * 1.14).toFixed(2),
                            'maximum-seller-allowed-price': (loss.cost * 1.14 * loss.distMult).toFixed(2),
                            'business-price': (loss.cost * 1.14 * loss.distMult).toFixed(2),
                            'quantity-price1':(price < 70) ? 5 : 1, 
                            'quantity-lower-bound2':(price < 70) ? 3 : '', 
                            'quantity-price2':(price < 70) ? 6 : '', 
                            'quantity-lower-bound3':(price < 70) ? 4 : '', 
                            'quantity-price3':(price < 70) ? 7 : '', 
                            'quantity-lower-bound4':(price < 70) ? 5 : '', 
                            'quantity-price4':(price < 70) ? 9 : '', 
                            'quantity-lower-bound5':(price < 70) ? 6 : '', 
                            'quantity-price5':(price < 70) ? 10 : '', 
                          }
                          newReprice.push(newRow)
                        })
                        console.log('Additional SKUs added from Amazon Listings:', additionalAmazonSKUs.length)
                      } else if (amazonSKUs[loss.sku]) {
                        console.log('SKU found only in Amazon Listings:', loss.sku)
                        let amazonSKUsToReprice = amazonListings.filter(e => e['seller-sku'].split('-')[0] === loss.mainSku)
                        console.log('Number of SKUs added from Amazon Listings:', amazonSKUsToReprice.length)
                        amazonSKUsToReprice.forEach(f => {
                          let price = (loss.cost * 1.14).toFixed(2)
                          let newRow = {
                            ...repricingRow,
                            sku: f['seller-sku'],
                            price: (loss.cost * 1.14 * loss.distMult).toFixed(2),
                            'minimum-seller-allowed-price': (loss.cost * 1.14).toFixed(2),
                            'maximum-seller-allowed-price': (loss.cost * 1.14 * loss.distMult).toFixed(2),
                            'business-price': (loss.cost * 1.14 * loss.distMult).toFixed(2),
                            'quantity-price1':(price < 70) ? 5 : 1, 
                            'quantity-lower-bound2':(price < 70) ? 3 : '', 
                            'quantity-price2':(price < 70) ? 6 : '', 
                            'quantity-lower-bound3':(price < 70) ? 4 : '', 
                            'quantity-price3':(price < 70) ? 7 : '', 
                            'quantity-lower-bound4':(price < 70) ? 5 : '', 
                            'quantity-price4':(price < 70) ? 9 : '', 
                            'quantity-lower-bound5':(price < 70) ? 6 : '', 
                            'quantity-price5':(price < 70) ? 10 : '', 
                          }
                          newReprice.push(newRow)
                        })
                      } else {
                        badSKUs.push(loss)
                      }
                    })
                    const csvString = papa.unparse(newReprice, {delimiter: "\t"});
                    saveAs(new Blob([csvString], { type: 'text/csv;charset=utf-8' }), 'New Reprice.txt');

                    if (multiSKUOrders.length > 0) {
                        const multiSKUOrdersData = papa.unparse(multiSKUOrders);
                        saveAs(new Blob([multiSKUOrdersData], { type: 'text/csv;charset=utf-8' }), 'New Reprice.csv');
                    }

                    if (badSKUs.length > 0) {
                        const badSKUsData = papa.unparse(badSKUs);
                        FileSaver.saveAs(new Blob([badSKUsData], { type: 'text/csv;charset=utf-8' }), 'New Reprice.csv');
                    }
                    alert('DONE')
                  }
                })
              }   
            })
          }
        })
      };
    // };

