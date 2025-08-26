const ChatMessage = require('../models/chatBot');
const Joi = require('joi');
const mongoose = require('mongoose');
const fetch = require('node-fetch');
const { v4: uuidv4 } = require('uuid');
const stringSimilarity = require('string-similarity');

const API_KEY = process.env.GEMINI_API_KEY;
const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${API_KEY}`;
const PRODUCTS_API_URL = 'https://api-zeal.onrender.com/api/products/active';
const BRANDS_API_URL = 'https://api-zeal.onrender.com/api/brands';
const COUPONS_API_URL = 'https://api-zeal.onrender.com/api/coupons';
const NEWS_API_URL = 'https://api-zeal.onrender.com/api/news';
const CATEGORIES_API_URL = 'https://api-zeal.onrender.com/api/categories';

// Định nghĩa navigationMap trước faqs
const navigationMap = {
  home: {
    description: "Trang chủ hiển thị sản phẩm nổi bật và tin tức.",
    url: "https://purebotanice.com",
    actions: ["Xem sản phẩm", "Xem tin tức"],
  },
  products: {
    description: "Trang danh sách sản phẩm, có thể lọc theo danh mục hoặc tìm kiếm.",
    url: "https://purebotanice.com/products",
    actions: ["Tìm sản phẩm", "Lọc theo danh mục", "Xem chi tiết sản phẩm"],
  },
  productDetail: {
    description: "Trang chi tiết sản phẩm, hiển thị giá, mô tả, và nút thêm vào giỏ hàng.",
    url: "https://purebotanice.com/product/:slug",
    actions: ["Thêm vào giỏ hàng", "Xem đánh giá"],
  },
  cart: {
    description: "Giỏ hàng hiển thị các sản phẩm đã chọn và nút thanh toán.",
    url: "https://purebotanice.com/cart",
    actions: ["Xem giỏ hàng", "Thanh toán"],
  },
  account: {
    description: "Trang thông tin khách hàng, quản lý đơn hàng và thông tin cá nhân.",
    url: "https://purebotanice.com/account",
    actions: ["Đăng nhập", "Đăng ký", "Cập nhật thông tin", "Xem đơn hàng", "Yêu cầu hoàn hàng"],
  },
  wishlist: {
    description: "Danh sách sản phẩm yêu thích.",
    url: "https://purebotanice.com/wishlist",
    actions: ["Xem danh sách yêu thích", "Thêm/xóa sản phẩm"],
  },
  contact: {
    description: "Trang liên hệ để gửi yêu cầu hỗ trợ.",
    url: "https://purebotanice.com/contact",
    actions: ["Gửi form liên hệ"],
  },
  news: {
    description: "Trang tin tức hiển thị các bài viết mới nhất.",
    url: "https://purebotanice.com/news",
    actions: ["Xem tin tức", "Đọc bài viết"],
  },
};

const messageValidationSchema = Joi.object({
  sessionId: Joi.string().required().messages({
    'string.empty': 'Session ID không được để trống',
    'any.required': 'Session ID là bắt buộc',
  }),
  message: Joi.string().required().min(1).messages({
    'string.empty': 'Tin nhắn không được để trống',
    'any.required': 'Tin nhắn là bắt buộc',
    'string.min': 'Tin nhắn phải có ít nhất 1 ký tự',
  }),
});

function correctSpelling(keyword) {
  const corrections = {
    'sửa rửa mặt': 'sữa rửa mặt',
    'sửa': 'sữa',
    'rửa mặt tạo bọt': 'sữa rửa mặt tạo bọt',
  };
  let corrected = keyword.toLowerCase();
  Object.keys(corrections).forEach(wrong => {
    corrected = corrected.replace(wrong, corrections[wrong]);
  });
  return corrected;
}

async function getCoupons() {
  try {
    const response = await fetch(COUPONS_API_URL, { timeout: 10000 });
    if (!response.ok) throw new Error(`Lỗi API mã giảm giá: ${response.status}`);
    const data = await response.json();
    const coupons = data.coupons || [];
    return coupons.filter(coupon => 
      coupon.isActive && 
      (!coupon.expiryDate || new Date(coupon.expiryDate) >= new Date()) && 
      (!coupon.usageLimit || coupon.usedCount < coupon.usageLimit)
    );
  } catch (error) {
    console.error('Lỗi khi lấy mã giảm giá:', error.message);
    return [];
  }
}

function summarizeCoupons(coupons) {
  if (coupons.length === 0) return 'Chưa có mã giảm giá.';
  return coupons.map(coupon => {
    const discount = coupon.discountType === 'percentage'
      ? `${coupon.discountValue}%`
      : `${coupon.discountValue.toLocaleString('vi-VN')} VNĐ`;
    return `Mã: ${coupon.code}\nGiảm: ${discount}\nHết hạn: ${coupon.expiryDate ? new Date(coupon.expiryDate).toLocaleDateString('vi-VN') : 'Không thời hạn'}`;
  }).join('\n---\n');
}

async function getActiveProducts() {
  try {
    const response = await fetch(PRODUCTS_API_URL, { timeout: 10000 });
    if (!response.ok) throw new Error(`Lỗi API sản phẩm: ${response.status}`);
    const data = await response.json();
    const products = Array.isArray(data) ? data : data.products || [];
    return products.filter(product => 
      product.isActive && 
      product.option && 
      product.option.some(opt => opt.stock > 0)
    );
  } catch (error) {
    console.error('Lỗi khi lấy sản phẩm:', error.message);
    return [];
  }
}

async function getBrands() {
  try {
    const response = await fetch(BRANDS_API_URL, { timeout: 10000 });
    if (!response.ok) throw new Error(`Lỗi API thương hiệu: ${response.status}`);
    const brands = await response.json();
    return brands.filter(brand => brand.status === 'show');
  } catch (error) {
    console.error('Lỗi khi lấy thương hiệu:', error);
    return [];
  }
}

async function getNews() {
  try {
    const response = await fetch(NEWS_API_URL, { timeout: 10000 });
    if (!response.ok) throw new Error(`Lỗi API tin tức: ${response.status}`);
    const news = await response.json();
    return news.filter(item => item.status === 'show').slice(0, 3);
  } catch (error) {
    console.error('Lỗi khi lấy tin tức:', error);
    return [];
  }
}

async function getCategories() {
  try {
    const response = await fetch(CATEGORIES_API_URL, { timeout: 10000 });
    if (!response.ok) throw new Error(`Lỗi API danh mục: ${response.status}`);
    const categories = await response.json();
    return categories.filter(category => category.status === 'show');
  } catch (error) {
    console.error('Lỗi khi lấy danh mục:', error);
    return [];
  }
}

function filterProducts(products, keyword) {
  if (!keyword) return products.slice(0, 3);
  const normalizedKeyword = correctSpelling(keyword).toLowerCase();
  const keywords = normalizedKeyword.split(/\s+/);
  const filtered = products
    .map(product => {
      const name = (product.name || '').toLowerCase();
      const shortDesc = (product.short_description || '').toLowerCase();
      let score = stringSimilarity.compareTwoStrings(normalizedKeyword, name) * 2;
      score += keywords.filter(kw => name.includes(kw) || shortDesc.includes(kw)).length;
      return { product, score };
    })
    .filter(item => item.score > 0.5)
    .sort((a, b) => b.score - a.score)
    .map(item => item.product)
    .slice(0, 3);
  return filtered;
}

function summarizeProducts(products) {
  if (products.length === 0) return 'Không tìm thấy sản phẩm.';
  return products.map(product => {
    const option = product.option && product.option[0]
      ? `Giá: ${product.option[0].price.toLocaleString('vi-VN')} VNĐ`
      : 'Giá: Liên hệ';
    const images = product.images && product.images.length > 0
      ? `Hình ảnh: ${product.images[0]}` // Chỉ lấy URL hình ảnh đầu tiên để ngắn gọn
      : 'Không có hình ảnh';
    return `Sản phẩm: ${product.name}\n${option}\n${images}\nLiên kết: https://purebotanice.com/product/${product.slug || 'khong-co-slug'}`;
  }).join('\n---\n');
}

function summarizeBrands(brands) {
  if (brands.length === 0) return 'Chưa có thương hiệu.';
  return brands.map(brand => `Thương hiệu: ${brand.name}`).join('\n---\n');
}

function summarizeNews(news) {
  if (news.length === 0) return 'Chưa có tin tức.';
  return news.map(item => 
    `Tiêu đề: ${item.title}\nLiên kết: ${item.slug ? `https://purebotanice.com/news/${item.slug}` : 'Không có liên kết'}`
  ).join('\n---\n');
}

function summarizeCategories(categories) {
  if (categories.length === 0) return 'Chưa có danh mục.';
  return categories.map(category => `Danh mục: ${category.name}`).join('\n---\n');
}

const faqs = [
  {
    question: "Sản phẩm của Pure Botanice có phù hợp với da nhạy cảm không?",
    answer: "Có, sản phẩm phù hợp với da nhạy cảm, không chứa thành phần gây hại."
  },
  {
    question: "Muốn hoàn hàng như nào?",
    answer: `Vào ${navigationMap.account.url}, chọn Đơn hàng, bấm Yêu cầu hoàn hàng, nhập lý do và gửi kèm ảnh/video.`
  },
  {
    question: "Có sản phẩm nào vừa dưỡng da vừa giúp thư giãn không?",
    answer: async () => {
      const products = await getActiveProducts();
      const suggestedProducts = filterProducts(products, 'dưỡng da thư giãn');
      return `Gợi ý:\n${summarizeProducts(suggestedProducts)}`;
    }
  },
  {
    question: "Gợi ý sữa rửa mặt tạo bọt",
    answer: async () => {
      const products = await getActiveProducts();
      const suggestedProducts = filterProducts(products, 'sữa rửa mặt tạo bọt');
      return `Gợi ý sữa rửa mặt tạo bọt:\n${summarizeProducts(suggestedProducts)}`;
    }
  },
  {
    question: "Làm sao để thanh toán đơn hàng?",
    answer: `Vào ${navigationMap.cart.url}, chọn Thanh toán, chọn phương thức tiền mặt hoặc chuyển khoản.`
  },
  {
    question: "Làm sao để xem đơn hàng của tôi?",
    answer: `Vào ${navigationMap.account.url}, chọn Đơn hàng, bấm Xem Chi Tiết.`
  },
  {
    question: "Làm sao để cập nhật thông tin cá nhân?",
    answer: `Vào ${navigationMap.account.url}, chọn Chỉnh sửa thông tin, sửa và bấm Lưu.`
  },
  {
    question: "Tôi muốn xem danh sách yêu thích (wishlist)?",
    answer: `Bấm biểu tượng trái tim tại ${navigationMap.wishlist.url}.`
  },
  {
    question: "Đăng nhập, Đăng ký ở đâu?",
    answer: `Vào ${navigationMap.account.url}, chọn Đăng nhập hoặc Đăng ký.`
  },
  {
    question: "Tôi muốn kiểm tra giỏ hàng thì làm sao?",
    answer: `Bấm biểu tượng giỏ hàng tại ${navigationMap.cart.url}.`
  },
  {
    question: "Có các thương hiệu và danh mục nào?",
    answer: async () => {
      const categories = await getCategories();
      const brands = await getBrands();
      return `Danh mục: ${summarizeCategories(categories)}\nThương hiệu: ${summarizeBrands(brands)}\nGiá: 100.000đ - 300.000đ, 300.000đ - 500.000đ, 500.000đ trở lên.`;
    }
  },
  {
    question: "Có mã giảm giá nào không?",
    answer: async () => {
      const coupons = await getCoupons();
      return coupons.length > 0
        ? `Mã giảm giá:\n${summarizeCoupons(coupons)}`
        : 'Chưa có mã giảm giá. Theo dõi trang web để cập nhật!';
    }
  },
  {
    question: "Có tin tức gì mới không?",
    answer: async () => {
      const news = await getNews();
      return `Tin tức mới:\n${summarizeNews(news)}`;
    }
  },
  {
    question: "Tin tức gần đây",
    answer: async () => {
      const news = await getNews();
      return `Tin tức mới:\n${summarizeNews(news)}`;
    }
  },
  {
    question: "Liên hệ với shop?",
    answer: `Truy cập ${navigationMap.contact.url}, điền form liên hệ và bấm Gửi.`
  },
  {
    question: "Làm sao để tìm sản phẩm trên web?",
    answer: `Truy cập ${navigationMap.products.url} để tìm sản phẩm. Bạn có thể lọc theo danh mục hoặc dùng ô tìm kiếm.`
  },
  {
    question: "Làm sao để thêm sản phẩm vào giỏ hàng?",
    answer: `Vào ${navigationMap.productDetail.url.replace(':slug', '<tên-sản-phẩm>')} để xem chi tiết sản phẩm, sau đó bấm "Thêm vào giỏ hàng".`
  },
];

exports.createOrGetSession = async (req, res) => {
  try {
    let { sessionId } = req.body;
    if (!sessionId) sessionId = uuidv4();

    let chatSession = await ChatMessage.findOne({ sessionId });
    if (!chatSession) {
      chatSession = new ChatMessage({
        sessionId,
        messages: [{ role: 'model', content: 'Pure Botanice xin chào! Hỏi về sản phẩm, mã giảm giá hay cách dùng web nhé!', timestamp: new Date() }],
      });
      await chatSession.save();
    }

    res.status(200).json({ sessionId });
  } catch (error) {
    console.error('Lỗi createOrGetSession:', error);
    res.status(500).json({ error: 'Lỗi server' });
  }
};

exports.sendMessage = async (req, res) => {
  try {
    const { error, value } = messageValidationSchema.validate(req.body);
    if (error) {
      console.log('Lỗi xác thực:', error.details);
      return res.status(400).json({ error: 'Dữ liệu không hợp lệ' });
    }

    const { sessionId, message } = value;
    if (!sessionId) return res.status(400).json({ error: 'Session ID là bắt buộc' });

    let chatSession = await ChatMessage.findOne({ sessionId });
    if (!chatSession) {
      chatSession = new ChatMessage({ sessionId, messages: [] });
    }

    chatSession.messages.push({ role: 'user', content: message, timestamp: new Date() });
    if (chatSession.messages.length > 100) chatSession.messages.shift();
    await chatSession.save();

    let botResponseText = '';
    let hasProductQuery = false;
    let hasBrandQuery = false;
    let hasCouponQuery = false;
    let hasNewsQuery = false;
    let hasCategoryQuery = false;
    let hasNavigationQuery = false;
    let suggestedProducts = [];
    let suggestedBrands = [];
    let suggestedCoupons = [];
    let suggestedNews = [];
    let suggestedCategories = [];

    const faqMatch = faqs.find(faq => faq.question.toLowerCase() === correctSpelling(message).toLowerCase());
    if (faqMatch) {
      botResponseText = typeof faqMatch.answer === 'function' ? await faqMatch.answer() : faqMatch.answer;
      if (faqMatch.question.toLowerCase().includes('mã giảm giá') || faqMatch.question.toLowerCase().includes('coupon') || faqMatch.question.toLowerCase().includes('khuyến mãi')) {
        hasCouponQuery = true;
        suggestedCoupons = await getCoupons();
      } else if (faqMatch.question.toLowerCase().includes('tin tức')) {
        hasNewsQuery = true;
        suggestedNews = await getNews();
      } else if (faqMatch.question.toLowerCase().includes('dưỡng da') || faqMatch.question.toLowerCase().includes('sản phẩm') || faqMatch.question.toLowerCase().includes('sữa rửa mặt')) {
        hasProductQuery = true;
        const products = await getActiveProducts();
        suggestedProducts = filterProducts(products, correctSpelling(faqMatch.question));
      } else if (faqMatch.question.toLowerCase().includes('thương hiệu') || faqMatch.question.toLowerCase().includes('danh mục')) {
        hasBrandQuery = true;
        hasCategoryQuery = true;
        suggestedBrands = await getBrands();
        suggestedCategories = await getCategories();
      } else if (faqMatch.question.toLowerCase().includes('truy cập') || faqMatch.question.toLowerCase().includes('làm sao')) {
        hasNavigationQuery = true;
      }
    } else {
      const productKeywords = ['sản phẩm', 'gợi ý', 'mua', 'kem', 'mặt nạ', 'toner', 'chống nắng', 'da', 'dưỡng', 'mỹ phẩm', 'chăm sóc', 'sữa rửa mặt', 'tạo bọt', 'vitamin c', 'rau má', 'tơ tằm', 'dưỡng ẩm', 'kiềm dầu', 'bí đao', 'charming', 'trang sức', 'mặt dây chuyền'];
      const brandKeywords = ['thương hiệu', 'brand'];
      const couponKeywords = ['mã giảm giá', 'coupon', 'khuyến mãi'];
      const newsKeywords = ['tin tức', 'news', 'bài viết', 'gần đây'];
      const categoryKeywords = ['danh mục', 'category'];
      const navigationKeywords = ['truy cập', 'đi đến', 'tìm trang', 'cách vào', 'làm sao vào', 'giỏ hàng', 'đăng nhập', 'đăng ký', 'wishlist', 'liên hệ', 'sản phẩm', 'thanh toán', 'đơn hàng', 'thông tin cá nhân', 'tin tức'];

      hasProductQuery = productKeywords.some(keyword => correctSpelling(message).toLowerCase().includes(keyword));
      hasBrandQuery = brandKeywords.some(keyword => message.toLowerCase().includes(keyword));
      hasCouponQuery = couponKeywords.some(keyword => message.toLowerCase().includes(keyword));
      hasNewsQuery = newsKeywords.some(keyword => message.toLowerCase().includes(keyword));
      hasCategoryQuery = categoryKeywords.some(keyword => message.toLowerCase().includes(keyword));
      hasNavigationQuery = navigationKeywords.some(keyword => correctSpelling(message).toLowerCase().includes(keyword));

      let context = 'Trả lời bằng tiếng Việt, ngắn gọn, chính xác, chỉ cung cấp thông tin cần thiết. Nếu liên quan đến điều hướng website, sử dụng thông tin sau:\n';
      context += JSON.stringify(navigationMap, null, 2) + '\n';
      context += 'Nếu gợi ý sản phẩm, liệt kê tối đa 3 sản phẩm với tên, giá, hình ảnh đầu tiên, liên kết. Luôn khuyến khích mua sắm.\n';

      if (hasNavigationQuery) {
        const matchedPage = Object.keys(navigationMap).find(page => 
          message.toLowerCase().includes(page) || 
          navigationMap[page].actions.some(action => 
            correctSpelling(message).toLowerCase().includes(action.toLowerCase())
          )
        );
        if (matchedPage) {
          botResponseText = `Để ${message.toLowerCase()}, truy cập ${navigationMap[matchedPage].url}. ${navigationMap[matchedPage].description}`;
        }
      }

      if (hasNewsQuery) {
        suggestedNews = await getNews();
        botResponseText = suggestedNews.length > 0
          ? `Tin tức mới:\n${summarizeNews(suggestedNews)}`
          : 'Chưa có tin tức mới. Theo dõi trang web để cập nhật!';
        context += `Tin tức: ${summarizeNews(suggestedNews)}\n`;
      }
      if (hasProductQuery) {
        const products = await getActiveProducts();
        suggestedProducts = filterProducts(products, correctSpelling(message));
        botResponseText = suggestedProducts.length > 0
          ? `Gợi ý sản phẩm:\n${summarizeProducts(suggestedProducts)}`
          : `Không tìm thấy sản phẩm "${message}". Gợi ý:\n${summarizeProducts(products.filter(p => p.name.toLowerCase().includes('sữa rửa mặt') || p.name.toLowerCase().includes('toner')).slice(0, 3))}`;
        context += `Sản phẩm: ${summarizeProducts(suggestedProducts)}\n`;
      }
      if (hasBrandQuery) {
        suggestedBrands = await getBrands();
        botResponseText = suggestedBrands.length > 0
          ? `Thương hiệu hiện có:\n${summarizeBrands(suggestedBrands)}`
          : 'Chưa có thông tin thương hiệu.';
        context += `Thương hiệu: ${summarizeBrands(suggestedBrands)}\n`;
      }
      if (hasCouponQuery) {
        suggestedCoupons = await getCoupons();
        botResponseText = suggestedCoupons.length > 0
          ? `Mã giảm giá:\n${summarizeCoupons(suggestedCoupons)}`
          : 'Chưa có mã giảm giá. Theo dõi trang web để cập nhật!';
        context += `Mã giảm giá: ${summarizeCoupons(suggestedCoupons)}\n`;
      }
      if (hasCategoryQuery) {
        suggestedCategories = await getCategories();
        botResponseText = suggestedCategories.length > 0
          ? `Danh mục hiện có:\n${summarizeCategories(suggestedCategories)}`
          : 'Chưa có danh mục.';
        context += `Danh mục: ${summarizeCategories(suggestedCategories)}\n`;
      }

      if (!faqMatch && !botResponseText) {
        const products = await getActiveProducts();
        context += `Sản phẩm: ${summarizeProducts(products)}\n`;
        const chatHistory = chatSession.messages.map(msg => ({
          role: msg.role,
          parts: [{ text: msg.content }],
        }));
        chatHistory.unshift({ role: 'model', parts: [{ text: context }] });

        const requestOptions = {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ contents: chatHistory }),
        };

        const response = await fetch(API_URL, requestOptions);
        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error?.message || 'Lỗi từ Gemini API');
        }

        const data = await response.json();
        botResponseText = data.candidates[0].content.parts[0].text.replace(/\*\*(.*?)\*\*/g, '$1').trim();
        if (hasProductQuery) {
          suggestedProducts = filterProducts(products, correctSpelling(message));
          botResponseText = suggestedProducts.length > 0
            ? `Gợi ý sản phẩm:\n${summarizeProducts(suggestedProducts)}`
            : `Không tìm thấy sản phẩm "${message}". Gợi ý:\n${summarizeProducts(products.filter(p => p.name.toLowerCase().includes('sữa rửa mặt') || p.name.toLowerCase().includes('toner')).slice(0, 3))}`;
        }
      }
    }

    chatSession.messages.push({ role: 'model', content: botResponseText, timestamp: new Date() });
    await chatSession.save();

    const responsePayload = { message: botResponseText };
    if (hasProductQuery && suggestedProducts.length > 0) {
      responsePayload.products = suggestedProducts.slice(0, 3).map(product => ({
        name: product.name,
        slug: product.slug || 'khong-co-slug',
        price: product.option && product.option[0] ? product.option[0].price : null,
        images: product.images || [], // Thêm trường images
      }));
    }
    if (hasBrandQuery && suggestedBrands.length > 0) {
      responsePayload.brands = suggestedBrands.slice(0, 3).map(brand => ({
        name: brand.name,
      }));
    }
    if (hasCouponQuery && suggestedCoupons.length > 0) {
      responsePayload.coupons = suggestedCoupons.slice(0, 3).map(coupon => ({
        code: coupon.code,
        discountValue: coupon.discountValue,
        discountType: coupon.discountType,
      }));
    }
    if (hasNewsQuery && suggestedNews.length > 0) {
      responsePayload.news = suggestedNews.slice(0, 3).map(item => ({
        title: item.title,
        slug: item.slug,
      }));
    }
    if (hasCategoryQuery && suggestedCategories.length > 0) {
      responsePayload.categories = suggestedCategories.slice(0, 3).map(category => ({
        name: category.name,
      }));
    }

    res.status(200).json(responsePayload);
  } catch (error) {
    console.error('Lỗi sendMessage:', error);
    if (error.message.includes('request entity too large')) {
      return res.status(413).json({ error: 'Yêu cầu quá lớn, tối đa 10MB' });
    }
    return res.status(500).json({ error: 'Lỗi server' });
  }
};

exports.getChatHistory = async (req, res) => {
  try {
    const { sessionId } = req.params;
    if (!sessionId) return res.status(400).json({ error: 'Session ID là bắt buộc' });

    const chatSession = await ChatMessage.findOne({ sessionId });
    if (!chatSession) return res.status(404).json({ error: 'Session không tồn tại' });

    res.status(200).json({ messages: chatSession.messages });
  } catch (error) {
    console.error('Lỗi getChatHistory:', error);
    res.status(500).json({ error: 'Lỗi server' });
  }
};

exports.deleteSession = async (req, res) => {
  try {
    const { sessionId } = req.params;
    if (!sessionId) return res.status(400).json({ error: 'Session ID là bắt buộc' });

    await ChatMessage.deleteOne({ sessionId });
    res.status(200).json({ message: 'Xóa session thành công' });
  } catch (error) {
    console.error('Lỗi deleteSession:', error);
    res.status(500).json({ error: 'Lỗi server' });
  }
};