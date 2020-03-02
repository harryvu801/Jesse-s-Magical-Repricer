const papa  = require('papaparse');
const FileSaver = require('file-saver')
const amazonListings = require('./AllAmazonListings.csv');
const rockBottomPrices = require('./RockBottomPrices.csv');

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
const badSKUs = [];
const newReprice = [];

let profitToolFile;

document.getElementById('file1').addEventListener('change', function (e) {
    var files = e.target.files;
    reader.onload = function(){
        profitToolFile = reader.result;
        alert('file Ready')
    };
    reader.readAsText(files[0]);
}, false);

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
    const csvString = Papa.unparse(newReprice, {delimiter: "\t"});
    saveAs(new Blob([csvString], { type: 'text/csv;charset=utf-8' }), 'New Reprice.txt');

    if (multiSKUOrders.length > 0) {
        const multiSKUOrdersData = papa.unparse(multiSKUOrders);
        saveAs(new Blob([multiSKUOrdersData], { type: 'text/csv;charset=utf-8' }), 'New Reprice.csv');
    }

    if (badSKUs.length > 0) {
        const badSKUsData = papa.unparse(badSKUs);
        FileSaver.saveAs(new Blob([badSKUsData], { type: 'text/csv;charset=utf-8' }), 'New Reprice.csv');
    }
  }
})