const db = require('../config/db');

exports.midtransWebhook = async (req, res) => {
  try {
    console.log('🔥 WEBHOOK MASUK');
    console.log(req.body);

    const { order_id, transaction_status } = req.body;

    let orderStatus = 'pending';

    if (transaction_status === 'settlement') {
      orderStatus = 'paid';
    } else if (['cancel','expire','deny'].includes(transaction_status)) {
      orderStatus = 'failed';
    }

    await db.query(
      `UPDATE orders SET status=? WHERE order_id=?`,
      [orderStatus, order_id]
    );

    await db.query(
      `UPDATE payments SET
        transaction_id=?,
        transaction_status=?,
        payment_method=?,
        raw_response=?
       WHERE order_id=?`,
      [
        req.body.transaction_id,
        transaction_status,
        req.body.payment_type,
        JSON.stringify(req.body),
        order_id
      ]
    );

    res.status(200).send('OK');
  } catch (err) {
    console.error('❌ WEBHOOK ERROR:', err);
    res.status(500).send('ERROR');
  }
};

