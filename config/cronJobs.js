const cron = require('node-cron');
const couponController = require('../controllers/couponController');

const checkAndCreateSpecialCoupons = () => {
  if (!global.specialCouponConfig) {
    console.log('No specialCouponConfig found, skipping creation.');
    return;
  }

  console.log('Current config:', global.specialCouponConfig);
  const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  console.log('Today is:', today);
  if (global.specialCouponConfig.specialDays.includes(today)) {
    console.log('Special day matched, creating coupons...');
    couponController.createAutoSpecialCoupons(global.specialCouponConfig);
  } else {
    console.log('No special day match today.');
  }
};

cron.schedule('0 0 * * *', () => {
  console.log('Checking for special day coupons at', new Date().toLocaleString());
  checkAndCreateSpecialCoupons();
}, {
  scheduled: true,
  timezone: 'Asia/Ho_Chi_Minh' // Đảm bảo múi giờ Việt Nam
});