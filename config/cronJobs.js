const cron = require('node-cron');
const couponController = require('../controllers/couponController');

// Hàm kiểm tra và chạy nếu là ngày đặc biệt
const checkAndCreateSpecialCoupons = () => {
  if (!global.specialCouponConfig) return;

  const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  if (global.specialCouponConfig.specialDays.includes(today)) {
    couponController.createAutoSpecialCoupons(global.specialCouponConfig);
  }
};

// Lập lịch chạy hàng ngày lúc 00:00
cron.schedule('0 0 * * *', () => {
  console.log('Checking for special day coupons...');
  checkAndCreateSpecialCoupons();
});