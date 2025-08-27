const { v4: uuidv4 } = require('uuid');
const ChatMessage = require('../models/chatBot');
const Joi = require('joi');
const mongoose = require('mongoose');
const fetch = require('node-fetch');
const stringSimilarity = require('string-similarity');
const multer = require('multer');
const fs = require('fs').promises;
const path = require('path');

const API_KEY = process.env.GEMINI_API_KEY;
const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${API_KEY}`;
const PRODUCTS_API_URL = 'https://api-zeal.onrender.com/api/products/active';
const BRANDS_API_URL = 'https://api-zeal.onrender.com/api/brands';
const COUPONS_API_URL = 'https://api-zeal.onrender.com/api/coupons';
const NEWS_API_URL = 'https://api-zeal.onrender.com/api/news';
const CATEGORIES_API_URL = 'https://api-zeal.onrender.com/api/categories';

// Cấu hình multer
const upload = multer({
  dest: 'uploads/',
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const filetypes = /jpeg|jpg|png/;
    const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = filetypes.test(file.mimetype);
    if (extname && mimetype) {
      return cb(null, true);
    } else {
      cb(new Error('Chỉ chấp nhận file JPG hoặc PNG!'));
    }
  },
});

// Schema xác thực
const imageAnalysisSchema = Joi.object({
  sessionId: Joi.string().required().messages({
    'string.empty': 'Session ID không được để trống',
    'any.required': 'Session ID là bắt buộc',
  }),
  image: Joi.any().optional().meta({ swaggerType: 'file' }).description('Hình ảnh da cần phân tích'),
  message: Joi.string().optional().allow('').min(0).max(5000).messages({
    'string.max': 'Tin nhắn không được vượt quá 5000 ký tự',
  }),
});

// Định nghĩa navigationMap (giữ nguyên từ mã ban đầu)
const navigationMap = {
  home: {
    description: "Trang chủ hiển thị sản phẩm nổi bật và tin tức.",
    url: "https://purebotanica.online/user",
    actions: ["Xem sản phẩm", "Xem tin tức", "Xem trang chủ"],
  },
  products: {
    description: "Trang danh sách sản phẩm, có thể lọc theo danh mục hoặc tìm kiếm.",
    url: "https://purebotanica.online/user/products",
    actions: ["Tìm sản phẩm", "Lọc theo danh mục", "Xem sản phẩm"],
  },
  productDetail: {
    description: "Trang chi tiết sản phẩm, hiển thị giá, mô tả, và nút thêm vào giỏ hàng.",
    url: "https://purebotanica.online/user/product/:slug",
    actions: ["Thêm vào giỏ hàng", "Xem đánh giá"],
  },
  cart: {
    description: "Giỏ hàng hiển thị các sản phẩm đã chọn và nút thanh toán.",
    url: "https://purebotanica.online/user/cart",
    actions: ["Xem giỏ hàng", "Thanh toán"],
  },
  account: {
    description: "Trang thông tin khách hàng, quản lý đơn hàng và thông tin cá nhân.",
    url: "https://purebotanica.online/user/userinfo",
    actions: ["Đăng nhập", "Đăng ký", "Cập nhật thông tin", "Xem đơn hàng", "Yêu cầu hoàn hàng"],
  },
  wishlist: {
    description: "Danh sách sản phẩm yêu thích.",
    url: "https://purebotanica.online/user/wishlist",
    actions: ["Xem danh sách yêu thích", "Thêm/xóa sản phẩm"],
  },
  contact: {
    description: "Trang liên hệ để gửi yêu cầu hỗ trợ.",
    url: "https://purebotanica.online/user/contact",
    actions: ["Gửi form liên hệ"],
  },
  news: {
    description: "Trang tin tức hiển thị các bài viết mới nhất.",
    url: "https://purebotanica.online/user/new",
    actions: ["Xem tin tức", "Đọc bài viết"],
  },
  return: {
    description: "Cách hoàn trả đơn hàng, bấm vào chi tiết đơn hàng và chọn yêu cầu hoàn hàng.",
    url: "https://purebotanica.online/user/userinfo?section=orders",
    actions: ["Hoàn đơn", "Yêu cầu hoàn hàng", "Trả hàng", "Hoàn tiền"],
  },
};

// Danh sách FAQ (từ mã ban đầu)
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
    answer: `Bấm biểu tượng trái tim tại ${navigationMap.wishlist.url} để xem danh sách yêu thích.`
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
  // Thêm FAQ cho "Da bị nám thì dùng sản phẩm gì"
  {
    question: "Da bị nám thì dùng sản phẩm gì",
    answer: async () => {
      const products = await getActiveProducts();
      const filteredProducts = filterProducts(products, 'nám');
      return filteredProducts.length > 0
        ? `Dưới đây là các sản phẩm giúp giảm nám:\n${summarizeProducts(filteredProducts)}`
        : 'Hiện tại không có sản phẩm nào phù hợp để giảm nám.';
    }
  },
];

// Hàm sửa lỗi chính tả
function correctSpelling(keyword) {
  const corrections = {
    'sửa rửa mặt': 'sữa rửa mặt',
    'sửa': 'sữa',
    'rửa mặt tạo bọt': 'sữa rửa mặt tạo bọt',
    'nam': 'nám',
    'mờ nam': 'mờ nám',
  };
  let corrected = keyword.toLowerCase();
  Object.keys(corrections).forEach(wrong => {
    corrected = corrected.replace(wrong, corrections[wrong]);
  });
  return corrected;
}

// Hàm lấy dữ liệu
async function getCoupons() {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);
    const response = await fetch(COUPONS_API_URL, { signal: controller.signal });
    clearTimeout(timeoutId);
    if (!response.ok) throw new Error(`Lỗi API mã giảm giá: ${response.status}`);
    const data = await response.json();
    const coupons = data.coupons || [];
    return coupons.filter(coupon => coupon.isActive && (!coupon.usageLimit || coupon.usedCount < coupon.usageLimit))
      .map(coupon => ({
        code: coupon.code || '',
        discountType: coupon.discountType || 'percentage',
        discountValue: coupon.discountValue || 0,
        minOrderValue: coupon.minOrderValue || 0,
        expiryDate: coupon.expiryDate || null,
        description: coupon.description || ''
      }));
  } catch (error) {
    console.error('Lỗi lấy mã giảm giá:', error.message);
    return [];
  }
}

async function getActiveProducts() {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);
    const response = await fetch(PRODUCTS_API_URL, { signal: controller.signal });
    clearTimeout(timeoutId);
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
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);
    const response = await fetch(BRANDS_API_URL, { signal: controller.signal });
    clearTimeout(timeoutId);
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
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);
    const response = await fetch(NEWS_API_URL, { signal: controller.signal });
    clearTimeout(timeoutId);
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
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);
    const response = await fetch(CATEGORIES_API_URL, { signal: controller.signal });
    clearTimeout(timeoutId);
    if (!response.ok) throw new Error(`Lỗi API danh mục: ${response.status}`);
    const categories = await response.json();
    return categories.filter(category => category.status === 'show');
  } catch (error) {
    console.error('Lỗi khi lấy danh mục:', error);
    return [];
  }
}

// Hàm lọc sản phẩm
function filterProducts(products, keyword) {
  console.log('Filtering products with keyword:', keyword);
  console.log('Available products:', products.map(p => p.name));
  if (!keyword) return products.slice(0, 3);
  const normalizedKeyword = correctSpelling(keyword).toLowerCase();
  const keywords = {
    'trắng da': ['trắng da', 'sáng da', 'mờ nám', 'làm sáng', 'brightening', 'whitening', 'vitamin c', 'niacinamide', 'arbutin'],
    'nám': ['nám', 'mờ nám', 'melasma', 'hyperpigmentation', 'dark spots', 'vitamin c', 'niacinamide', 'arbutin'],
    'da dầu': ['da dầu', 'kiểm soát dầu', 'sebum control'],
    'da khô': ['da khô', 'dưỡng ẩm', 'hydrating'],
    'mụn': ['mụn', 'acne', 'trị mụn'],
    'lão hóa': ['lão hóa', 'chống lão hóa', 'anti-aging'],
  };
  const conditionKeywords = keywords[normalizedKeyword] || [normalizedKeyword];
  return products
    .map(product => {
      const name = (product.name || '').toLowerCase();
      const shortDesc = (product.short_description || '').toLowerCase();
      const usage = (product.usage_instructions || '').toLowerCase();
      const ingredients = (product.ingredients || []).map(ing => ing.toLowerCase());
      const searchText = `${name} ${shortDesc} ${usage} ${ingredients.join(' ')}`;
      let score = stringSimilarity.compareTwoStrings(normalizedKeyword, searchText) * 2;
      score += conditionKeywords.filter(kw => searchText.includes(kw)).length;
      return { product, score };
    })
    .filter(item => {
      console.log(`Product: ${item.product.name}, Score: ${item.score}`);
      return item.score > 0.7;
    })
    .sort((a, b) => b.score - a.score)
    .map(item => item.product)
    .slice(0, 3);
}

// Hàm tóm tắt
function summarizeCoupons(coupons) {
  if (!coupons || coupons.length === 0) return 'Hiện tại không có mã giảm giá nào.';
  return coupons.map(c => 
    `Mã: ${c.code}\nGiảm: ${c.discountType === 'percentage' ? `${c.discountValue}%` : `${c.discountValue.toLocaleString('vi-VN')} VNĐ`}${c.minOrderValue ? `\nTối thiểu: ${c.minOrderValue.toLocaleString('vi-VN')} VNĐ` : ''}${c.expiryDate ? `\nHết hạn: ${new Date(c.expiryDate).toLocaleDateString('vi-VN')}` : '\nKhông thời hạn'}${c.description ? `\n${c.description}` : ''}`
  ).join('\n---\n');
}

function summarizeProducts(products) {
  if (products.length === 0) return 'Không có sản phẩm phù hợp.';
  return products.map(product => {
    const option = product.option && product.option[0]
      ? `Giá: ${product.option[0].price.toLocaleString('vi-VN')} VNĐ`
      : 'Giá: Liên hệ';
    const image = product.images && product.images.length > 0
      ? `Hình ảnh: ${product.images[0]}`
      : 'Không có hình ảnh';
    const description = product.short_description ? `Mô tả: ${product.short_description}` : '';
    return `- ${product.name}\n  ${option}\n  ${image}\n  ${description}\n  Liên kết: /user/detail/${product.slug || 'khong-co-slug'}`;
  }).join('\n');
}

function summarizeBrands(brands) {
  if (brands.length === 0) return 'Chưa có thương hiệu.';
  return brands.map(brand => `Thương hiệu: ${brand.name}`).join('\n---\n');
}

function summarizeNews(news) {
  if (news.length === 0) return 'Chưa có tin tức.';
  return news.map(item => 
    `Tiêu đề: ${item.title}\nLiên kết: ${item.slug ? `/user/news/${item.slug}` : 'Không có liên kết'}`
  ).join('\n---\n');
}

function summarizeCategories(categories) {
  if (categories.length === 0) return 'Chưa có danh mục.';
  return categories.map(category => `Danh mục: ${category.name}`).join('\n---\n');
}

// Hàm analyzeSkinImage
async function analyzeSkinImage(imageBuffer, userMessage) {
  try {
    const parts = [];
    if (userMessage) {
      parts.push({ text: userMessage });
    }
    if (imageBuffer) {
      const base64Image = imageBuffer.toString('base64');
      parts.push({
        inlineData: {
          mimeType: 'image/jpeg',
          data: base64Image,
        },
      });
    }

    const products = await getActiveProducts();
    const coupons = await getCoupons();
    console.log('Products fetched in analyzeSkinImage:', products.length);
    console.log('Coupons fetched in analyzeSkinImage:', coupons);

    const context = `Bạn là trợ lý chatbot của Pure Botanica. Nếu có hình ảnh, phân tích tình trạng da (da dầu, da khô, mụn, lão hóa, trắng da, nám, v.v.) và gợi ý sản phẩm phù hợp từ danh sách dưới đây. Nếu có câu hỏi văn bản, trả lời ngắn gọn, tự nhiên bằng tiếng Việt, sử dụng thông tin từ Pure Botanica. Nếu câu hỏi liên quan đến mã giảm giá, coupon, hoặc khuyến mãi, trả về danh sách mã giảm giá. Nếu câu hỏi liên quan đến trắng da, sáng da, hoặc nám, gợi ý sản phẩm có công dụng làm sáng da hoặc giảm nám (như Serum Sáng Da Mờ Nám Sơ-ri Vitamin C). Nếu là lời chào (chào, hi, hello, xin chào), trả lời: "Chào bạn! Mình là chatbot của Pure Botanica, sẵn sàng giúp bạn!" Nếu không biết, trả lời: "Xin lỗi, tôi không có đủ thông tin để trả lời câu hỏi này!"

    Dữ liệu sản phẩm: ${JSON.stringify(products.map(p => ({
      name: p.name,
      short_description: p.short_description || '',
      usage_instructions: p.usage_instructions || '',
      ingredients: p.ingredients || [],
      price: p.option && p.option[0] ? p.option[0].price : 0,
      images: p.images || [],
      slug: p.slug || 'khong-co-slug'
    })))}

    Dữ liệu mã giảm giá: ${JSON.stringify(coupons)}

    Output LUÔN là JSON: {
      "message": "phản hồi văn bản",
      "conditions": ["tình trạng da, ví dụ: trắng da, nám"],
      "products": [] hoặc mảng [{"name": "tên", "price": số, "images": [], "short_description": "mô tả", "slug": "slug"}],
      "coupons": [] hoặc mảng [{"code": "mã", "discountType": "percentage hoặc fixed", "discountValue": số, "minOrderValue": số, "expiryDate": "ngày hoặc null", "description": "mô tả"}]
    }`;

    // Xử lý lời chào ngay lập tức
    const greetingKeywords = ['chào', 'hello', 'hi', 'xin chào'];
    if (userMessage && greetingKeywords.some(keyword => userMessage.toLowerCase().includes(keyword))) {
      return {
        message: 'Chào bạn! Mình là chatbot của Pure Botanica, sẵn sàng giúp bạn. Hỏi về sản phẩm!',
        conditions: [],
        products: [],
        coupons: []
      };
    }

    if (!API_KEY) {
      console.error('Lỗi: Thiếu GEMINI_API_KEY');
      return {
        message: 'Xin lỗi, hệ thống chưa được cấu hình để trả lời câu hỏi này!',
        conditions: [],
        products: [],
        coupons: []
      };
    }

    const requestBody = {
      contents: [
        {
          role: 'user',
          parts: [
            { text: context },
            ...parts,
          ],
        },
      ],
      generationConfig: {
        responseMimeType: 'application/json'
      }
    };

    let response;
    try {
      response = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      });
    } catch (error) {
      console.error('Lỗi gọi Gemini API:', error.message);
      const products = await getActiveProducts();
      const normalizedMessage = userMessage ? correctSpelling(userMessage).toLowerCase() : '';
      const melasmaKeywords = ['nám', 'mờ nám', 'melasma', 'hyperpigmentation', 'dark spots'];
      const hasMelasmaQuery = melasmaKeywords.some(keyword => normalizedMessage.includes(keyword));
      const whiteningKeywords = ['trắng da', 'sáng da', 'mờ nám', 'làm sáng', 'brightening', 'whitening'];
      const hasWhiteningQuery = whiteningKeywords.some(keyword => normalizedMessage.includes(keyword));

      if (hasMelasmaQuery || hasWhiteningQuery) {
        const targetKeyword = hasMelasmaQuery ? 'nám' : 'trắng da';
        const filteredProducts = filterProducts(products, targetKeyword);
        return {
          message: filteredProducts.length > 0
            ? `Dưới đây là các sản phẩm giúp giảm ${targetKeyword}:\n${summarizeProducts(filteredProducts)}`
            : `Hiện tại không có sản phẩm nào phù hợp để giảm ${targetKeyword}.`,
          conditions: [targetKeyword],
          products: filteredProducts.map(p => ({
            name: p.name,
            price: p.option && p.option[0] ? p.option[0].price : 0,
            images: p.images || [],
            short_description: p.short_description || '',
            slug: p.slug || 'khong-co-slug'
          })),
          coupons: []
        };
      }
      return {
        message: 'Xin lỗi, hệ thống không thể kết nối với AI để phân tích. Bạn có thể thử hỏi về sản phẩm hoặc mã giảm giá!',
        conditions: [],
        products: [],
        coupons: []
      };
    }

    if (!response.ok) {
      console.error('Lỗi Gemini API:', response.status, await response.text());
      const products = await getActiveProducts();
      const normalizedMessage = userMessage ? correctSpelling(userMessage).toLowerCase() : '';
      const melasmaKeywords = ['nám', 'mờ nám', 'melasma', 'hyperpigmentation', 'dark spots'];
      const hasMelasmaQuery = melasmaKeywords.some(keyword => normalizedMessage.includes(keyword));
      const whiteningKeywords = ['trắng da', 'sáng da', 'mờ nám', 'làm sáng', 'brightening', 'whitening'];
      const hasWhiteningQuery = whiteningKeywords.some(keyword => normalizedMessage.includes(keyword));

      if (hasMelasmaQuery || hasWhiteningQuery) {
        const targetKeyword = hasMelasmaQuery ? 'nám' : 'trắng da';
        const filteredProducts = filterProducts(products, targetKeyword);
        return {
          message: filteredProducts.length > 0
            ? `Dưới đây là các sản phẩm giúp giảm ${targetKeyword}:\n${summarizeProducts(filteredProducts)}`
            : `Hiện tại không có sản phẩm nào phù hợp để giảm ${targetKeyword}.`,
          conditions: [targetKeyword],
          products: filteredProducts.map(p => ({
            name: p.name,
            price: p.option && p.option[0] ? p.option[0].price : 0,
            images: p.images || [],
            short_description: p.short_description || '',
            slug: p.slug || 'khong-co-slug'
          })),
          coupons: []
        };
      }
      return {
        message: 'Xin lỗi, hệ thống không thể kết nối với AI để phân tích. Bạn có thể thử hỏi về sản phẩm hoặc mã giảm giá!',
        conditions: [],
        products: [],
        coupons: []
      };
    }

    const data = await response.json();
    console.log('Gemini raw response:', data);
    if (!data.candidates || !data.candidates[0] || !data.candidates[0].content || !data.candidates[0].content.parts) {
      console.error('Phản hồi từ Gemini API không hợp lệ');
      const products = await getActiveProducts();
      const normalizedMessage = userMessage ? correctSpelling(userMessage).toLowerCase() : '';
      const melasmaKeywords = ['nám', 'mờ nám', 'melasma', 'hyperpigmentation', 'dark spots'];
      const hasMelasmaQuery = melasmaKeywords.some(keyword => normalizedMessage.includes(keyword));
      const whiteningKeywords = ['trắng da', 'sáng da', 'mờ nám', 'làm sáng', 'brightening', 'whitening'];
      const hasWhiteningQuery = whiteningKeywords.some(keyword => normalizedMessage.includes(keyword));

      if (hasMelasmaQuery || hasWhiteningQuery) {
        const targetKeyword = hasMelasmaQuery ? 'nám' : 'trắng da';
        const filteredProducts = filterProducts(products, targetKeyword);
        return {
          message: filteredProducts.length > 0
            ? `Dưới đây là các sản phẩm giúp giảm ${targetKeyword}:\n${summarizeProducts(filteredProducts)}`
            : `Hiện tại không có sản phẩm nào phù hợp để giảm ${targetKeyword}.`,
          conditions: [targetKeyword],
          products: filteredProducts.map(p => ({
            name: p.name,
            price: p.option && p.option[0] ? p.option[0].price : 0,
            images: p.images || [],
            short_description: p.short_description || '',
            slug: p.slug || 'khong-co-slug'
          })),
          coupons: []
        };
      }
      return {
        message: 'Xin lỗi, hệ thống không thể phân tích yêu cầu lúc này. Bạn có thể thử hỏi về sản phẩm hoặc mã giảm giá!',
        conditions: [],
        products: [],
        coupons: []
      };
    }

    let jsonResponse;
    try {
      jsonResponse = JSON.parse(data.candidates[0].content.parts[0].text);
      console.log('Gemini parsed response:', jsonResponse);
    } catch (parseError) {
      console.error('Lỗi parse JSON từ Gemini:', parseError);
      const products = await getActiveProducts();
      const normalizedMessage = userMessage ? correctSpelling(userMessage).toLowerCase() : '';
      const melasmaKeywords = ['nám', 'mờ nám', 'melasma', 'hyperpigmentation', 'dark spots'];
      const hasMelasmaQuery = melasmaKeywords.some(keyword => normalizedMessage.includes(keyword));
      const whiteningKeywords = ['trắng da', 'sáng da', 'mờ nám', 'làm sáng', 'brightening', 'whitening'];
      const hasWhiteningQuery = whiteningKeywords.some(keyword => normalizedMessage.includes(keyword));

      if (hasMelasmaQuery || hasWhiteningQuery) {
        const targetKeyword = hasMelasmaQuery ? 'nám' : 'trắng da';
        const filteredProducts = filterProducts(products, targetKeyword);
        return {
          message: filteredProducts.length > 0
            ? `Dưới đây là các sản phẩm giúp giảm ${targetKeyword}:\n${summarizeProducts(filteredProducts)}`
            : `Hiện tại không có sản phẩm nào phù hợp để giảm ${targetKeyword}.`,
          conditions: [targetKeyword],
          products: filteredProducts.map(p => ({
            name: p.name,
            price: p.option && p.option[0] ? p.option[0].price : 0,
            images: p.images || [],
            short_description: p.short_description || '',
            slug: p.slug || 'khong-co-slug'
          })),
          coupons: []
        };
      }
      return {
        message: 'Xin lỗi, có lỗi khi xử lý phản hồi từ AI. Bạn có thể thử hỏi về sản phẩm hoặc mã giảm giá!',
        conditions: [],
        products: [],
        coupons: []
      };
    }

    // Dự phòng: nếu câu hỏi liên quan đến trắng da hoặc nám
    const whiteningKeywords = ['trắng da', 'sáng da', 'mờ nám', 'làm sáng', 'brightening', 'whitening'];
    const melasmaKeywords = ['nám', 'mờ nám', 'melasma', 'hyperpigmentation', 'dark spots'];
    const hasWhiteningQuery = userMessage && whiteningKeywords.some(keyword => userMessage.toLowerCase().includes(keyword));
    const hasMelasmaQuery = userMessage && melasmaKeywords.some(keyword => userMessage.toLowerCase().includes(keyword));

    if ((hasWhiteningQuery || hasMelasmaQuery) && (!jsonResponse.products || jsonResponse.products.length === 0)) {
      const targetKeyword = hasMelasmaQuery ? 'nám' : 'trắng da';
      const filteredProducts = filterProducts(products, targetKeyword);
      jsonResponse.products = filteredProducts.map(p => ({
        name: p.name,
        price: p.option && p.option[0] ? p.option[0].price : 0,
        images: p.images || [],
        short_description: p.short_description || '',
        slug: p.slug || 'khong-co-slug'
      }));
      jsonResponse.conditions = [targetKeyword];
      jsonResponse.message = filteredProducts.length > 0
        ? `Dưới đây là các sản phẩm giúp giảm ${targetKeyword}:\n${summarizeProducts(filteredProducts)}`
        : `Hiện tại không có sản phẩm nào phù hợp để giảm ${targetKeyword}.`;
    }

    // Dự phòng: nếu câu hỏi liên quan đến mã giảm giá
    const couponKeywords = ['mã giảm giá', 'coupon', 'khuyến mãi'];
    const hasCouponQuery = userMessage && couponKeywords.some(keyword => userMessage.toLowerCase().includes(keyword));
    if (hasCouponQuery && (!jsonResponse.coupons || jsonResponse.coupons.length === 0)) {
      jsonResponse.coupons = coupons;
      jsonResponse.message = coupons.length > 0 
        ? summarizeCoupons(coupons) 
        : 'Hiện tại không có mã giảm giá nào.';
    }

    return jsonResponse;
  } catch (error) {
    console.error('Lỗi khi phân tích trong analyzeSkinImage:', error.message, error.stack);
    const products = await getActiveProducts();
    const coupons = await getCoupons();
    const normalizedMessage = userMessage ? correctSpelling(userMessage).toLowerCase() : '';
    const melasmaKeywords = ['nám', 'mờ nám', 'melasma', 'hyperpigmentation', 'dark spots'];
    const hasMelasmaQuery = melasmaKeywords.some(keyword => normalizedMessage.includes(keyword));
    const whiteningKeywords = ['trắng da', 'sáng da', 'mờ nám', 'làm sáng', 'brightening', 'whitening'];
    const hasWhiteningQuery = whiteningKeywords.some(keyword => normalizedMessage.includes(keyword));
    const couponKeywords = ['mã giảm giá', 'coupon', 'khuyến mãi'];
    const hasCouponQuery = couponKeywords.some(keyword => normalizedMessage.includes(keyword));
    const greetingKeywords = ['chào', 'hello', 'hi', 'xin chào'];
    const isGreeting = greetingKeywords.some(keyword => normalizedMessage.includes(keyword));

    if (isGreeting) {
      return {
        message: 'Chào bạn! Mình là chatbot của Pure Botanica, sẵn sàng giúp bạn!',
        conditions: [],
        products: [],
        coupons: []
      };
    } else if (hasMelasmaQuery || hasWhiteningQuery) {
      const targetKeyword = hasMelasmaQuery ? 'nám' : 'trắng da';
      const filteredProducts = filterProducts(products, targetKeyword);
      return {
        message: filteredProducts.length > 0
          ? `Dưới đây là các sản phẩm giúp giảm ${targetKeyword}:\n${summarizeProducts(filteredProducts)}`
          : `Hiện tại không có sản phẩm nào phù hợp để giảm ${targetKeyword}.`,
        conditions: [targetKeyword],
        products: filteredProducts.map(p => ({
          name: p.name,
          price: p.option && p.option[0] ? p.option[0].price : 0,
          images: p.images || [],
          short_description: p.short_description || '',
          slug: p.slug || 'khong-co-slug'
        })),
        coupons: []
      };
    } else if (hasCouponQuery) {
      return {
        message: coupons.length > 0 
          ? summarizeCoupons(coupons) 
          : 'Hiện tại không có mã giảm giá nào.',
        conditions: [],
        products: [],
        coupons: coupons
      };
    }
    return {
      message: 'Xin lỗi, không thể xử lý yêu cầu lúc này. Bạn có thể thử hỏi về sản phẩm hoặc mã giảm giá!',
      conditions: [],
      products: [],
      coupons: []
    };
  }
}

// Hàm analyzeSkin
exports.analyzeSkin = [
  upload.single('image'),
  async (req, res) => {
    try {
      const { error, value } = imageAnalysisSchema.validate({
        sessionId: req.body.sessionId,
        image: req.file,
        message: req.body.message,
      });
      if (error) {
        console.log('Lỗi xác thực trong analyzeSkin:', error.details);
        return res.status(400).json({ error: error.details[0].message });
      }

      const { sessionId, message } = value;
      if (!req.file && !message) {
        return res.status(400).json({ error: 'Phải cung cấp ít nhất hình ảnh hoặc tin nhắn' });
      }

      let chatSession = await ChatMessage.findOne({ sessionId });
      if (!chatSession) {
        chatSession = new ChatMessage({ sessionId, messages: [] });
      }

      const userContent = message || 'Phân tích tình trạng da từ hình ảnh';
      const userMessageObj = {
        role: 'user',
        content: userContent,
        timestamp: new Date(),
      };

      if (req.file) {
        const imageBuffer = await fs.readFile(req.file.path);
        const imageBase64 = imageBuffer.toString('base64');
        userMessageObj.imageBase64 = imageBase64;
        userMessageObj.imageMetadata = {
          mimeType: req.file.mimetype,
          filename: req.file.originalname,
        };
      }

      chatSession.messages.push(userMessageObj);

      let botResponse = { message: '', conditions: [], products: [], coupons: [], news: [], brands: [], categories: [] };
      let suggestedProducts = [];
      let suggestedCoupons = [];
      let suggestedNews = [];
      let suggestedBrands = [];
      let suggestedCategories = [];

      const normalizedMessage = correctSpelling(userContent).toLowerCase();
      console.log('Normalized message:', normalizedMessage);
      const whiteningKeywords = ['trắng da', 'sáng da', 'mờ nám', 'làm sáng', 'brightening', 'whitening'];
      const melasmaKeywords = ['nám', 'mờ nám', 'melasma', 'hyperpigmentation', 'dark spots'];
      const acneKeywords = ['mụn', 'acne', 'trị mụn'];
      const oilySkinKeywords = ['da dầu', 'kiểm soát dầu', 'sebum control'];
      const drySkinKeywords = ['da khô', 'dưỡng ẩm', 'hydrating'];
      const couponKeywords = ['mã giảm giá', 'coupon', 'khuyến mãi'];
      const greetingKeywords = ['chào', 'hello', 'hi', 'xin chào'];
      const hasWhiteningQuery = whiteningKeywords.some(keyword => normalizedMessage.includes(keyword));
      const hasMelasmaQuery = melasmaKeywords.some(keyword => normalizedMessage.includes(keyword));
      const hasAcneQuery = acneKeywords.some(keyword => normalizedMessage.includes(keyword));
      const hasOilySkinQuery = oilySkinKeywords.some(keyword => normalizedMessage.includes(keyword));
      const hasDrySkinQuery = drySkinKeywords.some(keyword => normalizedMessage.includes(keyword));
      const hasCouponQuery = couponKeywords.some(keyword => normalizedMessage.includes(keyword));
      const isGreeting = greetingKeywords.some(keyword => normalizedMessage.includes(keyword));
      console.log('Has whitening query:', hasWhiteningQuery);
      console.log('Has melasma query:', hasMelasmaQuery);
      console.log('Has acne query:', hasAcneQuery);
      console.log('Has oily skin query:', hasOilySkinQuery);
      console.log('Has dry skin query:', hasDrySkinQuery);
      console.log('Has coupon query:', hasCouponQuery);
      console.log('Is greeting:', isGreeting);

      // Xử lý khi có hình ảnh
      if (req.file) {
        const imageBuffer = await fs.readFile(req.file.path);
        botResponse = await analyzeSkinImage(imageBuffer, message);

        const skinConditions = botResponse.conditions || [];
        if (skinConditions.length > 0) {
          const primaryCondition = skinConditions[0]; // Lấy tình trạng da chính
          const conditionInVietnamese = {
            'acne': 'mụn',
            'melasma': 'nám',
            'hyperpigmentation': 'nám',
            'oily': 'da dầu',
            'dry': 'da khô',
            'whitening': 'trắng da',
            'brightening': 'trắng da'
          }[primaryCondition.toLowerCase()] || primaryCondition;

          const products = await getActiveProducts();
          suggestedProducts = filterProducts(products, conditionInVietnamese).slice(0, 2);
          botResponse.message = suggestedProducts.length > 0
            ? `Dựa trên hình ảnh, da bạn có dấu hiệu ${conditionInVietnamese}. Tôi gợi ý một số sản phẩm phù hợp.`
            : `Dựa trên hình ảnh, da bạn có dấu hiệu ${conditionInVietnamese}, nhưng hiện tại không có sản phẩm nào phù hợp.`;
          botResponse.products = suggestedProducts.map(p => ({
            name: p.name,
            price: p.option && p.option[0] ? p.option[0].price : 0,
            images: p.images || [],
            short_description: p.short_description || '',
            slug: p.slug || 'khong-co-slug'
          }));
          botResponse.conditions = [conditionInVietnamese];
        } else {
          botResponse.message = 'Xin lỗi, tôi không thể xác định rõ tình trạng da từ hình ảnh. Bạn có thể mô tả thêm hoặc thử hỏi về sản phẩm cụ thể!';
          botResponse.conditions = [];
          botResponse.products = [];
        }
      }
      // Xử lý lời chào
      else if (isGreeting && !hasWhiteningQuery && !hasMelasmaQuery && !hasAcneQuery && !hasOilySkinQuery && !hasDrySkinQuery && !hasCouponQuery) {
        botResponse = {
          message: 'Chào bạn! Mình là chatbot của Pure Botanica, sẵn sàng giúp bạn!',
          conditions: [],
          products: [],
          coupons: [],
          news: [],
          brands: [],
          categories: []
        };
      }
      // Xử lý câu hỏi về mã giảm giá
      else if (hasCouponQuery) {
        suggestedCoupons = await getCoupons();
        console.log('Coupons fetched in non-FAQ:', suggestedCoupons);
        botResponse = {
          message: suggestedCoupons.length > 0
            ? 'Dưới đây là các mã giảm giá hiện có.'
            : 'Hiện tại không có mã giảm giá nào. Theo dõi trang web để cập nhật nhé!',
          conditions: [],
          products: [],
          coupons: suggestedCoupons,
          news: [],
          brands: [],
          categories: []
        };
      }
      // Xử lý câu hỏi về tình trạng da (nám, trắng da, mụn, da dầu, da khô)
      else if (hasWhiteningQuery || hasMelasmaQuery || hasAcneQuery || hasOilySkinQuery || hasDrySkinQuery) {
        const products = await getActiveProducts();
        let targetKeyword;
        if (hasMelasmaQuery) targetKeyword = 'nám';
        else if (hasWhiteningQuery) targetKeyword = 'trắng da';
        else if (hasAcneQuery) targetKeyword = 'mụn';
        else if (hasOilySkinQuery) targetKeyword = 'da dầu';
        else targetKeyword = 'da khô';

        suggestedProducts = filterProducts(products, targetKeyword).slice(0, 2);
        botResponse = {
          message: suggestedProducts.length > 0
            ? `Tôi gợi ý một số sản phẩm phù hợp với tình trạng ${targetKeyword}.`
            : `Hiện tại không có sản phẩm nào phù hợp với tình trạng ${targetKeyword}.`,
          conditions: [targetKeyword],
          products: suggestedProducts.map(p => ({
            name: p.name,
            price: p.option && p.option[0] ? p.option[0].price : 0,
            images: p.images || [],
            short_description: p.short_description || '',
            slug: p.slug || 'khong-co-slug'
          })),
          coupons: [],
          news: [],
          brands: [],
          categories: []
        };
      }
      // Xử lý FAQ
      else {
        const faqMatch = faqs.find(faq => faq.question.toLowerCase() === normalizedMessage);
        if (faqMatch) {
          botResponse.message = typeof faqMatch.answer === 'function' ? await faqMatch.answer() : faqMatch.answer;
          if (
            faqMatch.question.toLowerCase().includes('sản phẩm') ||
            faqMatch.question.toLowerCase().includes('dưỡng da') ||
            faqMatch.question.toLowerCase().includes('trắng da') ||
            faqMatch.question.toLowerCase().includes('nám') ||
            faqMatch.question.toLowerCase().includes('mụn') ||
            faqMatch.question.toLowerCase().includes('da dầu') ||
            faqMatch.question.toLowerCase().includes('da khô') ||
            faqMatch.question.toLowerCase().includes('sữa rửa mặt')
          ) {
            const products = await getActiveProducts();
            const targetKeyword = faqMatch.question.toLowerCase().includes('nám')
              ? 'nám'
              : faqMatch.question.toLowerCase().includes('trắng da')
              ? 'trắng da'
              : faqMatch.question.toLowerCase().includes('mụn')
              ? 'mụn'
              : faqMatch.question.toLowerCase().includes('da dầu')
              ? 'da dầu'
              : faqMatch.question.toLowerCase().includes('da khô')
              ? 'da khô'
              : faqMatch.question;
            suggestedProducts = filterProducts(products, targetKeyword).slice(0, 2);
            botResponse.message = suggestedProducts.length > 0
              ? `Tôi gợi ý một số sản phẩm phù hợp với ${targetKeyword}.`
              : `Hiện tại không có sản phẩm nào phù hợp với ${targetKeyword}.`;
            botResponse.products = suggestedProducts.map(p => ({
              name: p.name,
              price: p.option && p.option[0] ? p.option[0].price : 0,
              images: p.images || [],
              short_description: p.short_description || '',
              slug: p.slug || 'khong-co-slug'
            }));
            botResponse.conditions = [targetKeyword];
          }
          if (
            faqMatch.question.toLowerCase().includes('mã giảm giá') ||
            faqMatch.question.toLowerCase().includes('coupon') ||
            faqMatch.question.toLowerCase().includes('khuyến mãi')
          ) {
            suggestedCoupons = await getCoupons();
            botResponse.message = suggestedCoupons.length > 0
              ? 'Dưới đây là các mã giảm giá hiện có.'
              : 'Hiện tại không có mã giảm giá nào. Theo dõi trang web để cập nhật nhé!';
            botResponse.coupons = suggestedCoupons;
          }
          if (faqMatch.question.toLowerCase().includes('tin tức')) {
            suggestedNews = await getNews();
            botResponse.message = suggestedNews.length > 0
              ? 'Dưới đây là các tin tức mới nhất.'
              : 'Hiện tại không có tin tức mới.';
            botResponse.news = suggestedNews.map(item => ({
              title: item.title,
              slug: item.slug || null,
              thumbnailUrl: item.thumbnailUrl || null,
              publishedAt: item.publishedAt || null,
            }));
          }
          if (faqMatch.question.toLowerCase().includes('thương hiệu') || faqMatch.question.toLowerCase().includes('danh mục')) {
            suggestedBrands = await getBrands();
            suggestedCategories = await getCategories();
            botResponse.brands = suggestedBrands.map(brand => ({
              name: brand.name,
              logoImg: brand.logoImg || null,
            }));
            botResponse.categories = suggestedCategories.map(category => ({
              name: category.name,
            }));
            botResponse.message = 'Dưới đây là thông tin về thương hiệu và danh mục.';
          }
        } else {
          botResponse.message = 'Xin lỗi, tôi không có đủ thông tin để trả lời câu hỏi này! Bạn có thể thử hỏi về sản phẩm hoặc mã giảm giá.';
        }
      }

      if (req.file) {
        await fs.unlink(req.file.path).catch(err => console.error('Lỗi xóa file tạm:', err));
      }

      let botResponseText = botResponse.message;
      if (botResponseText.length > 500) {
        const lines = botResponseText.split('\n');
        let truncated = '';
        let charCount = 0;
        for (const line of lines) {
          if (charCount + line.length + 1 > 500) break;
          truncated += line + '\n';
          charCount += line.length + 1;
        }
        botResponseText = truncated.trim() + '...';
      }

      const botMessageObj = {
        role: 'model',
        content: botResponseText,
        timestamp: new Date(),
        products: botResponse.products || [],
        coupons: suggestedCoupons,
        news: suggestedNews.map(item => ({
          title: item.title,
          slug: item.slug || null,
          thumbnailUrl: item.thumbnailUrl || null,
          publishedAt: item.publishedAt || null,
        })),
        brands: suggestedBrands.map(brand => ({
          name: brand.name,
          logoImg: brand.logoImg || null,
        })),
        categories: suggestedCategories.map(category => ({
          name: category.name,
        })),
      };

      chatSession.messages.push(botMessageObj);
      if (chatSession.messages.length > 200) {
        chatSession.messages.shift();
      }
      try {
        await chatSession.save();
      } catch (dbError) {
        console.error('Lỗi lưu chat session:', dbError.message);
        return res.status(200).json({
          message: 'Xin lỗi, có lỗi khi lưu lịch sử chat. Dưới đây là phản hồi của bạn:\n' + botResponseText,
          products: botResponse.products || [],
          coupons: suggestedCoupons,
          news: suggestedNews,
          brands: suggestedBrands,
          categories: suggestedCategories
        });
      }

      const responsePayload = { message: botResponseText };
      if (botResponse.products.length > 0) responsePayload.products = botResponse.products;
      if (suggestedCoupons.length > 0) responsePayload.coupons = botMessageObj.coupons;
      if (suggestedNews.length > 0) responsePayload.news = botMessageObj.news;
      if (suggestedBrands.length > 0) responsePayload.brands = botMessageObj.brands;
      if (suggestedCategories.length > 0) responsePayload.categories = botMessageObj.categories;

      console.log('Response payload:', responsePayload);
      res.status(200).json(responsePayload);
    } catch (error) {
      console.error('Lỗi analyzeSkin:', error.message, error.stack);
      if (req.file) {
        await fs.unlink(req.file.path).catch(err => console.error('Lỗi xóa file tạm:', err));
      }
      if (error.message.includes('request entity too large')) {
        return res.status(413).json({ error: 'Hình ảnh quá lớn, tối đa 10MB' });
      }
      const products = await getActiveProducts();
      const normalizedMessage = message ? correctSpelling(message).toLowerCase() : '';
      const melasmaKeywords = ['nám', 'mờ nám', 'melasma', 'hyperpigmentation', 'dark spots'];
      const acneKeywords = ['mụn', 'acne', 'trị mụn'];
      const whiteningKeywords = ['trắng da', 'sáng da', 'mờ nám', 'làm sáng', 'brightening', 'whitening'];
      const oilySkinKeywords = ['da dầu', 'kiểm soát dầu', 'sebum control'];
      const drySkinKeywords = ['da khô', 'dưỡng ẩm', 'hydrating'];
      const hasMelasmaQuery = melasmaKeywords.some(keyword => normalizedMessage.includes(keyword));
      const hasAcneQuery = acneKeywords.some(keyword => normalizedMessage.includes(keyword));
      const hasWhiteningQuery = whiteningKeywords.some(keyword => normalizedMessage.includes(keyword));
      const hasOilySkinQuery = oilySkinKeywords.some(keyword => normalizedMessage.includes(keyword));
      const hasDrySkinQuery = drySkinKeywords.some(keyword => normalizedMessage.includes(keyword));

      if (hasMelasmaQuery || hasWhiteningQuery || hasAcneQuery || hasOilySkinQuery || hasDrySkinQuery) {
        const targetKeyword = hasMelasmaQuery ? 'nám' : hasWhiteningQuery ? 'trắng da' : hasAcneQuery ? 'mụn' : hasOilySkinQuery ? 'da dầu' : 'da khô';
        const filteredProducts = filterProducts(products, targetKeyword);
        return res.status(200).json({
          message: filteredProducts.length > 0
            ? `Tôi gợi ý một số sản phẩm phù hợp với tình trạng ${targetKeyword}.`
            : `Hiện tại không có sản phẩm nào phù hợp với tình trạng ${targetKeyword}.`,
          conditions: [targetKeyword],
          products: filteredProducts.map(p => ({
            name: p.name,
            price: p.option && p.option[0] ? p.option[0].price : 0,
            images: p.images || [],
            short_description: p.short_description || '',
            slug: p.slug || 'khong-co-slug'
          })),
          coupons: [],
          news: [],
          brands: [],
          categories: []
        });
      }
      return res.status(200).json({
        message: 'Xin lỗi, hệ thống gặp sự cố khi xử lý yêu cầu. Bạn có thể thử hỏi về sản phẩm hoặc mã giảm giá!',
        conditions: [],
        products: [],
        coupons: [],
        news: [],
        brands: [],
        categories: []
      });
    }
  },
];

// Các hàm khác (giữ nguyên từ mã trước)
exports.createOrGetSession = async (req, res) => {
  try {
    let { sessionId } = req.body;
    if (!sessionId) sessionId = uuidv4();

    let chatSession = await ChatMessage.findOne({ sessionId });
    if (!chatSession) {
      chatSession = new ChatMessage({
        sessionId,
        messages: [{ role: 'model', content: 'Pure Botanica xin chào! Tôi có thể giúp gì cho bạn?', timestamp: new Date() }],
      });
      await chatSession.save();
    }

    res.status(200).json({ sessionId });
  } catch (error) {
    console.error('Lỗi createOrGetSession:', error);
    res.status(500).json({ error: 'Lỗi server' });
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