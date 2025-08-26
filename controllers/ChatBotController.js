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
    console.log('Đang gọi API:', COUPONS_API_URL);
    const response = await fetch(COUPONS_API_URL, { timeout: 10000 });
    if (!response.ok) {
      throw new Error(`Lỗi từ API mã giảm giá: ${response.status} - ${response.statusText}`);
    }
    const data = await response.json();
    console.log('Dữ liệu từ API /api/coupons:', JSON.stringify(data, null, 2));

    const coupons = data.coupons || [];
    const validCoupons = coupons.filter(coupon => {
      const isActive = coupon.isActive;
      const notExpired = !coupon.expiryDate || new Date(coupon.expiryDate) >= new Date();
      const hasRemainingUses = !coupon.usageLimit || coupon.usedCount < coupon.usageLimit;
      console.log(`Kiểm tra mã ${coupon.code}: isActive=${isActive}, notExpired=${notExpired}, hasRemainingUses=${hasRemainingUses}`);
      return isActive && notExpired && hasRemainingUses;
    });

    console.log('Mã giảm giá hợp lệ:', JSON.stringify(validCoupons, null, 2));
    return validCoupons;
  } catch (error) {
    console.error('Lỗi khi lấy mã giảm giá:', error.message, error.stack);
    return [];
  }
}

function summarizeCoupons(coupons) {
  if (coupons.length === 0) {
    return 'Hiện tại chưa có mã giảm giá nào hợp lệ.';
  }
  return coupons
    .map(coupon => {
      const discount = coupon.discountType === 'percentage'
        ? `${coupon.discountValue}%`
        : `${coupon.discountValue.toLocaleString('vi-VN')} VNĐ`;
      return `Mã: ${coupon.code}\nGiảm: ${discount}\nĐơn tối thiểu: ${coupon.minOrderValue.toLocaleString('vi-VN')} VNĐ\nHết hạn: ${coupon.expiryDate ? new Date(coupon.expiryDate).toLocaleDateString('vi-VN') : 'Không thời hạn'}\nMô tả: ${coupon.description || 'Không có mô tả'}`;
    })
    .join('\n---\n');
}

async function getActiveProducts() {
  try {
    console.log('Đang gọi API sản phẩm:', PRODUCTS_API_URL);
    const response = await fetch(PRODUCTS_API_URL, { timeout: 10000 });
    console.log('Mã trạng thái API:', response.status);
    if (!response.ok) {
      throw new Error(`Lỗi từ API sản phẩm: ${response.status} - ${response.statusText}`);
    }
    const data = await response.json();
    console.log('Dữ liệu sản phẩm thô:', JSON.stringify(data, null, 2));

    const products = Array.isArray(data) ? data : data.products || [];
    const activeProducts = products.filter(product =>
      product.isActive &&
      product.option &&
      product.option.some(opt => opt.stock > 0)
    );

    console.log('Sản phẩm còn hàng:', JSON.stringify(activeProducts, null, 2));
    return activeProducts;
  } catch (error) {
    console.error('Lỗi khi lấy sản phẩm:', error.message, error.stack);
    return [];
  }
}

async function getBrands() {
  try {
    const response = await fetch(BRANDS_API_URL, { timeout: 10000 });
    if (!response.ok) throw new Error(`Lỗi từ API thương hiệu: ${response.status} - ${response.statusText}`);
    const brands = await response.json();
    return brands.filter(brand => brand.status === 'show');
  } catch (error) {
    console.error('Lỗi khi lấy thương hiệu:', error);
    return [];
  }
}

async function getNews() {
  try {
    console.log('Đang gọi API tin tức:', NEWS_API_URL);
    const response = await fetch(NEWS_API_URL, { timeout: 10000 });
    if (!response.ok) throw new Error(`Lỗi từ API tin tức: ${response.status} - ${response.statusText}`);
    const news = await response.json();
    console.log('Dữ liệu tin tức thô:', JSON.stringify(news, null, 2));
    return news.filter(item => item.status === 'show').slice(0, 3);
  } catch (error) {
    console.error('Lỗi khi lấy tin tức:', error);
    return [];
  }
}

async function getCategories() {
  try {
    const response = await fetch(CATEGORIES_API_URL, { timeout: 10000 });
    if (!response.ok) throw new Error(`Lỗi từ API danh mục: ${response.status} - ${response.statusText}`);
    const categories = await response.json();
    return categories.filter(category => category.status === 'show');
  } catch (error) {
    console.error('Lỗi khi lấy danh mục:', error);
    return [];
  }
}

function filterProducts(products, keyword) {
  console.log('Từ khóa tìm kiếm:', keyword);
  console.log('Số sản phẩm đầu vào:', products.length);

  if (!keyword) {
    console.log('Không có từ khóa, trả về tối đa 3 sản phẩm còn hàng');
    return products.slice(0, 3);
  }

  const normalizedKeyword = correctSpelling(keyword);
  const keywords = normalizedKeyword.toLowerCase().split(/\s+/);
  const primaryKeywords = ['sữa rửa mặt', 'tạo bọt', 'toner', 'kem chống nắng', 'dưỡng ẩm', 'trang sức', 'mặt dây chuyền'];

  const filtered = products
    .map(product => {
      const name = (product.name || '').toLowerCase();
      const shortDesc = (product.short_description || name).toLowerCase();
      const desc = (product.description || name).toLowerCase();

      let score = 0;
      if (primaryKeywords.some(kw => name.includes(kw) || shortDesc.includes(kw) || desc.includes(kw))) {
        score += 2;
      }
      const secondaryMatches = keywords.filter(kw => name.includes(kw) || shortDesc.includes(kw) || desc.includes(kw)).length;
      score += secondaryMatches;

      const similarity = stringSimilarity.compareTwoStrings(normalizedKeyword, name);
      if (similarity > 0.6) score += 1;

      console.log(`Sản phẩm ${product.name}: score=${score}, similarity=${similarity}`);
      return { product, score };
    })
    .filter(item => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .map(item => item.product)
    .slice(0, 3);

  console.log('Sản phẩm sau lọc:', JSON.stringify(filtered, null, 2));
  return filtered;
}

function summarizeProducts(products) {
  if (products.length === 0) return 'Không có sản phẩm phù hợp.';
  return products.map(product => {
    const option = product.option && product.option[0]
      ? `Giá: ${product.option[0].price.toLocaleString('vi-VN')} VNĐ, Còn hàng: ${product.option[0].stock}`
      : 'Giá: Liên hệ';
    const images = product.images && product.images.length > 0
      ? `Hình ảnh: ${product.images.length} ảnh (xem bên dưới)`
      : 'Không có hình ảnh';
    return `Sản phẩm: ${product.name}\nMô tả ngắn: ${product.short_description || 'Không có mô tả ngắn'}\nChi tiết: ${product.description ? product.description.substring(0, 200) + '...' : 'Không có chi tiết'}\n${option}\n${images}\n`;
  }).join('\n---\n');
}

function summarizeBrands(brands) {
  if (brands.length === 0) return 'Không có thương hiệu nào hiện tại.';
  return brands.map(brand => `Thương hiệu: ${brand.name}\nLogo: ${brand.logoImg || 'Không có logo'}\n`).join('\n---\n');
}

function summarizeNews(news) {
  if (news.length === 0) return 'Hiện tại chưa có tin tức nào.';
  return news.map(item => {
    const link = item.slug ? `https://purebotanice.com/news/${item.slug}` : 'Không có liên kết';
    return `Tiêu đề: ${item.title}\nNgày đăng: ${new Date(item.publishedAt).toLocaleDateString('vi-VN')}\nTóm tắt: ${item.content.substring(0, 100)}...\nLiên kết: ${link}\nHình ảnh: ${item.thumbnailUrl || 'Không có hình ảnh'}`;
  }).join('\n---\n');
}

function summarizeCategories(categories) {
  if (categories.length === 0) return 'Không có danh mục nào hiện tại.';
  return categories.map(category => `Danh mục: ${category.name}\n`).join('\n---\n');
}

const faqs = [
  {
    question: "Sản phẩm của Pure Botanice có phù hợp với da nhạy cảm không?",
    answer: "Có. Các sản phẩm đều được nghiên cứu và sản xuất với tiêu chuẩn cao, không chứa thành phần gây hại, phù hợp cho cả làn da nhạy cảm."
  },
  {
    question: "Muốn hoàn hàng như nào?",
    answer: "Bạn hãy bấm vào biểu tượng người dùng trên góc phải, chọn thông tin khách hàng, bấm vào đơn hàng chọn xem chi tiết đơn cần hoàn, bấm nút yêu cầu hoàn hàng và nhập lý do và hình ảnh hoặc video về sản phẩm."
  },
  {
    question: "Có sản phẩm nào vừa dưỡng da vừa giúp thư giãn không?",
    answer: async () => {
      const products = await getActiveProducts();
      const suggestedProducts = filterProducts(products, 'dưỡng da thư giãn');
      return `Pure Botanice gợi ý:\n${summarizeProducts(suggestedProducts)}`;
    }
  },
  {
    question: "Gợi ý sữa rửa mặt tạo bọt",
    answer: async () => {
      const products = await getActiveProducts();
      const suggestedProducts = filterProducts(products, 'sữa rửa mặt tạo bọt');
      return `Chào bạn! Dưới đây là các sản phẩm sữa rửa mặt tạo bọt được gợi ý:\n${summarizeProducts(suggestedProducts)}`;
    }
  },
  {
    question: "Làm sao để thanh toán đơn hàng?",
    answer: "Sau khi vào Giỏ hàng, bạn chọn Thanh toán để tiến hành đặt hàng. Có 2 phần thanh toán tiền mặt và chuyển khoản ngân hàng."
  },
  {
    question: "Làm sao để xem đơn hàng của tôi?",
    answer: "Bạn nhấn vào biểu tượng người dùng trên góc phải, chọn Thông tin khách hàng. Sau đó vào mục Đơn hàng để kiểm tra. Nếu xem chi tiết, hãy bấm Xem Chi Tiết."
  },
  {
    question: "Làm sao để cập nhật thông tin cá nhân?",
    answer: "Bạn nhấn vào biểu tượng người dùng trên góc phải, chọn Thông tin khách hàng. Sau đó bấm vào Chỉnh sửa thông tin. Sửa xong, tiến hành bấm Lưu để lưu thông tin."
  },
  {
    question: "Tôi muốn xem danh sách yêu thích (wishlist)?",
    answer: "Bấm vào biểu tượng trái tim trên góc phải để xem danh sách sản phẩm bạn đã yêu thích."
  },
  {
    question: "Đăng nhập, Đăng ký ở đâu?",
    answer: "Bạn nhấn vào biểu tượng người dùng trên góc phải. Nếu bạn đã có tài khoản hoặc đăng nhập bằng Google, tiến hành đăng nhập. Nếu chưa có tài khoản, nhấn vào nút Đăng ký để đăng ký tài khoản!"
  },
  {
    question: "Tôi muốn kiểm tra giỏ hàng thì làm sao?",
    answer: "Nhấn vào biểu tượng Giỏ hàng trên góc phải để xem các sản phẩm đã thêm."
  },
  {
    question: "Có các thương hiệu và danh mục nào?",
    answer: async () => {
      const categories = await getCategories();
      const brands = await getBrands();
      return `Pure Botanice có các danh mục: ${summarizeCategories(categories)}\nThương hiệu: ${summarizeBrands(brands)}\nCó các phân khúc giá: 100.000đ - 300.000đ, 300.000đ - 500.000đ, 500.000đ trở lên.`;
    }
  },
  {
    question: "Có mã giảm giá nào không?",
    answer: async () => {
      const coupons = await getCoupons();
      if (coupons.length === 0) {
        return 'Hiện tại chưa có mã giảm giá nào hợp lệ. Hãy theo dõi trang web và fanpage của Pure Botanice để cập nhật các chương trình khuyến mãi mới!';
      }
      return `Hiện tại shop có các mã giảm giá:\n${summarizeCoupons(coupons)}\nHãy nhanh tay áp dụng khi mua sắm nhé!`;
    }
  },
  {
    question: "Có tin tức gì mới không?",
    answer: async () => {
      const news = await getNews();
      return `Tin tức mới nhất từ Pure Botanice:\n${summarizeNews(news)}\nXem chi tiết tại trang tin tức của shop nhé!`;
    }
  },
  {
    question: "Tin tức gần đây",
    answer: async () => {
      const news = await getNews();
      return `Tin tức mới nhất từ Pure Botanice:\n${summarizeNews(news)}\nXem chi tiết tại trang tin tức của shop nhé!`;
    }
  },
  {
    question: "Liên hệ với shop?",
    answer: "Để liên hệ với chúng tôi, bạn hãy truy cập trang liên hệ và nhập đầy đủ thông tin vào form liên hệ sau đó bấm gửi và đợi chúng tôi phản hồi. Nếu có thắc mắc gì về sản phẩm, hãy để Pure Botanice tư vấn cho bạn!"
  }
];

exports.createOrGetSession = async (req, res) => {
  try {
    let { sessionId } = req.body;
    if (!sessionId) {
      sessionId = uuidv4();
    }

    let chatSession = await ChatMessage.findOne({ sessionId });
    if (!chatSession) {
      chatSession = new ChatMessage({
        sessionId,
        messages: [{ role: 'model', content: 'Pure Botanice xin chào bạn! 👋\nTôi có thể giúp gì cho bạn hôm nay? Hỏi về sản phẩm, mã giảm giá, tin tức hay bất cứ điều gì bạn muốn nhé!', timestamp: new Date() }],
      });
      await chatSession.save();
    }

    res.status(200).json({ sessionId });
  } catch (error) {
    console.error('Lỗi trong createOrGetSession:', error);
    res.status(500).json({ error: 'Lỗi server khi tạo hoặc lấy session chat' });
  }
};

exports.sendMessage = async (req, res) => {
  try {
    const { error, value } = messageValidationSchema.validate(req.body);
    if (error) {
      console.log('Validation error:', error.details);
      return res.status(400).json({ error: error.details.map((e) => e.message).join(', ') });
    }

    const { sessionId, message } = value;

    if (!sessionId) {
      return res.status(400).json({ error: 'Session ID là bắt buộc' });
    }

    let chatSession = await ChatMessage.findOne({ sessionId });
    if (!chatSession) {
      chatSession = new ChatMessage({ sessionId, messages: [] });
    }

    chatSession.messages.push({ role: 'user', content: message, timestamp: new Date() });

    if (chatSession.messages.length > 100) {
      chatSession.messages.shift();
    }
    await chatSession.save();

    let botResponseText = '';
    let hasProductQuery = false;
    let hasBrandQuery = false;
    let hasCouponQuery = false;
    let hasNewsQuery = false;
    let hasCategoryQuery = false;
    let suggestedProducts = [];
    let suggestedBrands = [];
    let suggestedCoupons = [];
    let suggestedNews = [];
    let suggestedCategories = [];

    const faqMatch = faqs.find(faq => faq.question.toLowerCase() === correctSpelling(message).toLowerCase());
    if (faqMatch) {
      if (faqMatch.question.toLowerCase().includes('mã giảm giá') || faqMatch.question.toLowerCase().includes('coupon') || faqMatch.question.toLowerCase().includes('khuyến mãi')) {
        hasCouponQuery = true;
        suggestedCoupons = await getCoupons();
        botResponseText = suggestedCoupons.length > 0
          ? `Chào bạn! Hiện tại shop có các mã giảm giá:\n${summarizeCoupons(suggestedCoupons)}\nHãy nhanh tay áp dụng khi mua sắm nhé!`
          : 'Chào bạn! Hiện tại chưa có mã giảm giá nào hợp lệ. Hãy theo dõi trang web và fanpage của Pure Botanice để cập nhật các chương trình khuyến mãi mới!';
      } else if (faqMatch.question.toLowerCase().includes('tin tức')) {
        hasNewsQuery = true;
        suggestedNews = await getNews();
        botResponseText = typeof faqMatch.answer === 'function' ? await faqMatch.answer() : `${faqMatch.answer}`;
      } else if (faqMatch.question.toLowerCase().includes('dưỡng da') || faqMatch.question.toLowerCase().includes('sản phẩm') || faqMatch.question.toLowerCase().includes('sữa rửa mặt')) {
        hasProductQuery = true;
        const products = await getActiveProducts();
        suggestedProducts = filterProducts(products, correctSpelling(faqMatch.question));
        botResponseText = typeof faqMatch.answer === 'function' ? await faqMatch.answer() : `${faqMatch.answer}`;
      } else {
        botResponseText = typeof faqMatch.answer === 'function' ? await faqMatch.answer() : `${faqMatch.answer}`;
      }
    } else {
      const productKeywords = [
        'sản phẩm', 'gợi ý', 'mua', 'kem', 'mặt nạ', 'toner', 'chống nắng', 'da', 'dưỡng',
        'mỹ phẩm', 'chăm sóc', 'làn da', 'sữa rửa mặt', 'tạo bọt', 'sửa rửa mặt', 'vitamin c',
        'rau má', 'tơ tằm', 'dưỡng ẩm', 'kiềm dầu', 'bí đao', 'charming', 'trang sức', 'mặt dây chuyền'
      ];
      const brandKeywords = ['thương hiệu', 'brand'];
      const couponKeywords = ['mã giảm giá', 'coupon', 'khuyến mãi'];
      const newsKeywords = ['tin tức', 'news', 'bài viết', 'gần đây'];
      const categoryKeywords = ['danh mục', 'category'];

      hasProductQuery = productKeywords.some(keyword => correctSpelling(message).toLowerCase().includes(keyword));
      hasBrandQuery = brandKeywords.some(keyword => message.toLowerCase().includes(keyword));
      hasCouponQuery = couponKeywords.some(keyword => message.toLowerCase().includes(keyword));
      hasNewsQuery = newsKeywords.some(keyword => message.toLowerCase().includes(keyword));
      hasCategoryQuery = categoryKeywords.some(keyword => message.toLowerCase().includes(keyword));

      console.log('Câu hỏi của khách hàng:', message);
      console.log('hasNewsQuery:', hasNewsQuery);

      let context = '';
      if (hasNewsQuery) {
        console.log('Phát hiện yêu cầu về tin tức...');
        suggestedNews = await getNews();
        botResponseText = suggestedNews.length > 0
          ? `Chào bạn! Dưới đây là các tin tức mới nhất từ Pure Botanice:\n${summarizeNews(suggestedNews)}\nXem chi tiết tại trang tin tức của shop nhé!`
          : 'Chào bạn! Hiện tại chưa có tin tức mới. Hãy theo dõi trang web và fanpage của Pure Botanice để cập nhật nhé!';
        context += `Danh sách tin tức hiện có: ${summarizeNews(suggestedNews)}\n\n`;
      }
      if (hasProductQuery) {
        console.log('Phát hiện yêu cầu gợi ý sản phẩm...');
        const products = await getActiveProducts();
        suggestedProducts = filterProducts(products, correctSpelling(message));
        botResponseText = suggestedProducts.length > 0
          ? `Chào bạn! Dưới đây là các sản phẩm gợi ý phù hợp với yêu cầu của bạn:\n${summarizeProducts(suggestedProducts)}\nThông tin chi tiết hiển thị bên dưới.`
          : `Chào bạn! Không tìm thấy sản phẩm khớp với "${message}". Dưới đây là một số sản phẩm chăm sóc da nổi bật:\n${summarizeProducts(products.filter(p => p.name.toLowerCase().includes('sữa rửa mặt') || p.name.toLowerCase().includes('toner')).slice(0, 3))}\nThông tin chi tiết hiển thị bên dưới.`;
        context += `Danh sách sản phẩm hiện có: ${summarizeProducts(suggestedProducts)}\n\n`;
      }
      if (hasBrandQuery) {
        console.log('Phát hiện yêu cầu về thương hiệu...');
        suggestedBrands = await getBrands();
        context += `Danh sách thương hiệu hiện có: ${summarizeBrands(suggestedBrands)}\n\n`;
      }
      if (hasCouponQuery) {
        console.log('Phát hiện yêu cầu về mã giảm giá...');
        suggestedCoupons = await getCoupons();
        context += `Danh sách mã giảm giá hiện có: ${summarizeCoupons(suggestedCoupons)}\n\n`;
        botResponseText = suggestedCoupons.length > 0
          ? `Chào bạn! Hiện tại shop có các mã giảm giá:\n${summarizeCoupons(suggestedCoupons)}\nHãy nhanh tay áp dụng khi mua sắm nhé!`
          : 'Chào bạn! Hiện tại chưa có mã giảm giá nào hợp lệ. Hãy theo dõi trang web và fanpage của Pure Botanice để cập nhật các chương trình khuyến mãi mới!';
      }
      if (hasCategoryQuery) {
        console.log('Phát hiện yêu cầu về danh mục...');
        suggestedCategories = await getCategories();
        context += `Danh sách danh mục hiện có: ${summarizeCategories(suggestedCategories)}\n\n`;
      }

      if (!faqMatch && !botResponseText) {
        const products = await getActiveProducts();
        context += `Danh sách sản phẩm hiện có: ${summarizeProducts(products)}\n\n`;
        context += 'Hãy trả lời câu hỏi của khách hàng bằng tiếng Việt, thân thiện, khuyến khích mua sắm, và đề cập rằng thông tin chi tiết sẽ được hiển thị bên dưới nếu có.';

        const chatHistory = chatSession.messages.map(msg => ({
          role: msg.role,
          parts: [{ text: msg.content }],
        }));
        chatHistory.unshift({
          role: 'model',
          parts: [{ text: context }],
        });

        console.log('Chat history size:', JSON.stringify({ contents: chatHistory }).length, 'bytes');

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
          botResponseText += suggestedProducts.length > 0
            ? `\n\nDưới đây là một số sản phẩm gợi ý:\n${summarizeProducts(suggestedProducts)}`
            : `\n\nDưới đây là một số sản phẩm chăm sóc da nổi bật:\n${summarizeProducts(products.filter(p => p.name.toLowerCase().includes('sữa rửa mặt') || p.name.toLowerCase().includes('toner')).slice(0, 3))}`;
        }
      }
    }

    chatSession.messages.push({ role: 'model', content: botResponseText, timestamp: new Date() });
    await chatSession.save();

    const responsePayload = { message: botResponseText };
    if (hasProductQuery && suggestedProducts.length > 0) {
      responsePayload.products = suggestedProducts.map(product => ({
        name: product.name,
        price: product.option && product.option[0] ? product.option[0].price : null,
        images: product.images || [],
      }));
    }
    if (hasBrandQuery && suggestedBrands.length > 0) {
      responsePayload.brands = suggestedBrands.map(brand => ({
        name: brand.name,
        logoImg: brand.logoImg,
      }));
    }
    if (hasCouponQuery && suggestedCoupons.length > 0) {
      responsePayload.coupons = suggestedCoupons.map(coupon => ({
        code: coupon.code,
        discountValue: coupon.discountValue,
        discountType: coupon.discountType,
        minOrderValue: coupon.minOrderValue,
        expiryDate: coupon.expiryDate,
      }));
    }
    if (hasNewsQuery && suggestedNews.length > 0) {
      responsePayload.news = suggestedNews.map(item => ({
        title: item.title,
        slug: item.slug,
        thumbnailUrl: item.thumbnailUrl,
        publishedAt: item.publishedAt,
      }));
    }
    if (hasCategoryQuery && suggestedCategories.length > 0) {
      responsePayload.categories = suggestedCategories.map(category => ({
        name: category.name,
      }));
    }

    res.status(200).json(responsePayload);
  } catch (error) {
    console.error('Lỗi trong sendMessage:', error);
    if (error.message && error.message.includes('request entity too large')) {
      return res.status(413).json({ error: 'Kích thước yêu cầu quá lớn, tối đa 10MB' });
    } else {
      return res.status(500).json({ error: 'Lỗi server khi gửi tin nhắn', details: error.message });
    }
  }
};

exports.getChatHistory = async (req, res) => {
  try {
    const { sessionId } = req.params;
    if (!sessionId) {
      return res.status(400).json({ error: 'Session ID là bắt buộc' });
    }

    const chatSession = await ChatMessage.findOne({ sessionId });
    if (!chatSession) {
      return res.status(404).json({ error: 'Session không tồn tại' });
    }

    res.status(200).json({ messages: chatSession.messages });
  } catch (error) {
    console.error('Lỗi trong getChatHistory:', error);
    res.status(500).json({ error: 'Lỗi server khi lấy lịch sử chat' });
  }
};

exports.deleteSession = async (req, res) => {
  try {
    const { sessionId } = req.params;
    if (!sessionId) {
      return res.status(400).json({ error: 'Session ID là bắt buộc' });
    }

    await ChatMessage.deleteOne({ sessionId });
    res.status(200).json({ message: 'Xóa session chat thành công' });
  } catch (error) {
    console.error('Lỗi trong deleteSession:', error);
    res.status(500).json({ error: 'Lỗi server khi xóa session chat' });
  }
};