const Decimal = require('decimal.js');

function decimal(value = 0) {
  return new Decimal(value === '' || value === null || value === undefined ? 0 : value);
}

function money(value = 0) {
  return decimal(value).toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toNumber();
}

function moneyString(value = 0) {
  return decimal(value).toFixed(2);
}

function addMoney(left = 0, right = 0) {
  return money(decimal(left).plus(decimal(right)));
}

module.exports = { Decimal, decimal, money, moneyString, addMoney };
