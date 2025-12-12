// backend/src/services/midtrans.service.js
const midtransClient = require('midtrans-client');
require('dotenv').config();

// Initialize Snap API client
const snap = new midtransClient.Snap({
  isProduction: process.env.MIDTRANS_IS_PRODUCTION === 'true',
  serverKey: process.env.MIDTRANS_SERVER_KEY,
  clientKey: process.env.MIDTRANS_CLIENT_KEY
});

// Initialize Core API client (untuk check status)
const coreApi = new midtransClient.CoreApi({
  isProduction: process.env.MIDTRANS_IS_PRODUCTION === 'true',
  serverKey: process.env.MIDTRANS_SERVER_KEY,
  clientKey: process.env.MIDTRANS_CLIENT_KEY
});

// Create transaction and get snap token
exports.createTransaction = async (transactionDetails) => {
  try {
    const parameter = {
      transaction_details: {
        order_id: transactionDetails.order_id,
        gross_amount: parseInt(transactionDetails.gross_amount)
      },
      customer_details: transactionDetails.customer_details,
      item_details: transactionDetails.item_details
    };

    const transaction = await snap.createTransaction(parameter);
    return transaction.token;

  } catch (error) {
    console.error('Midtrans create transaction error:', error);
    throw new Error(`Gagal membuat transaksi Midtrans: ${error.message}`);
  }
};

// Check transaction status
exports.checkTransactionStatus = async (order_id) => {
  try {
    const statusResponse = await coreApi.transaction.status(order_id);
    return statusResponse;

  } catch (error) {
    console.error('Midtrans check status error:', error);
    throw new Error(`Gagal cek status transaksi: ${error.message}`);
  }
};

// Cancel transaction
exports.cancelTransaction = async (order_id) => {
  try {
    const cancelResponse = await coreApi.transaction.cancel(order_id);
    return cancelResponse;

  } catch (error) {
    console.error('Midtrans cancel transaction error:', error);
    throw new Error(`Gagal cancel transaksi: ${error.message}`);
  }
};

// Approve transaction (for credit card challenge)
exports.approveTransaction = async (order_id) => {
  try {
    const approveResponse = await coreApi.transaction.approve(order_id);
    return approveResponse;

  } catch (error) {
    console.error('Midtrans approve transaction error:', error);
    throw new Error(`Gagal approve transaksi: ${error.message}`);
  }
};