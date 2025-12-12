const midtransClient = require('midtrans-client');
require('dotenv').config();

const isProduction = process.env.MIDTRANS_IS_PRODUCTION === 'true';

const snap = new midtransClient.Snap({
  isProduction,
  serverKey: process.env.MIDTRANS_SERVER_KEY,
  clientKey: process.env.MIDTRANS_CLIENT_KEY
});

const coreApi = new midtransClient.CoreApi({
  isProduction,
  serverKey: process.env.MIDTRANS_SERVER_KEY,
  clientKey: process.env.MIDTRANS_CLIENT_KEY
});

exports.createTransaction = async (data) => {
  if (!data.order_id || !data.gross_amount) {
    throw new Error('Order ID atau gross amount tidak valid');
  }

  const parameter = {
    transaction_details: {
      order_id: data.order_id,
      gross_amount: Number(data.gross_amount)
    },
    customer_details: data.customer_details,
    item_details: data.item_details
  };

  const transaction = await snap.createTransaction(parameter);
  return transaction.token;
};

exports.checkTransactionStatus = async (order_id) => {
  return await coreApi.transaction.status(order_id);
};

exports.cancelTransaction = async (order_id) => {
  return await coreApi.transaction.cancel(order_id);
};

exports.approveTransaction = async (order_id) => {
  return await coreApi.transaction.approve(order_id);
};
