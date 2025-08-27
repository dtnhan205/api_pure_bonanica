const cron = require('node-cron');
const couponController = require('../controllers/couponController');

const checkAndCreateSpecialCoupons = async () => {
  if (!global.specialCouponConfig) {
    console.log('No specialCouponConfig found, skipping creation.');
    return;
  }

  console.log('Current config:', global.specialCouponConfig);
  const today = new Date().toISOString().slice(0, 10); 
  console.log('Today is:', today);

  const specialDay = global.specialCouponConfig.specialDays.find(d => d.date === today);
  if (specialDay) {
    console.log(`Special day matched: ${specialDay.date} - ${specialDay.description}`);
    try {
      const createdCoupon = await couponController.createAutoSpecialCoupons(global.specialCouponConfig);
      console.log(`Successfully created special coupon: ${createdCoupon.code}`);
    } catch (error) {
      console.error('Error creating special coupons:', error.message);
    }
  } else {
    console.log('No special day match today.');
  }
};

cron.schedule('0 0 * * *', () => {
  console.log('Checking for special day coupons at', new Date().toLocaleString('en-US', { timeZone: 'Asia/Ho_Chi_Minh' }));
  checkAndCreateSpecialCoupons();
}, {
  scheduled: true,
  timezone: 'Asia/Ho_Chi_Minh'
});