const ChatMessage = require('../models/chatBot');
const Joi = require('joi');
const mongoose = require('mongoose');
const fetch = require('node-fetch');
const { v4: uuidv4 } = require('uuid');

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

// Hàm lấy mã giảm giá
async function getCoupons() {
  try {
    console.log('Đang gọi API:', COUPONS_API_URL);
    const response = await fetch(COUPONS_API_URL);
    if (!response.ok) {
      throw new Error(`Lỗi từ API mã giảm giá: ${response.status}`);
    }
    const data = await response.json();
    console.log('Dữ liệu từ API /api/coupons:', JSON.stringify(data, null, 2));

    // Lấy danh sách coupons từ data.coupons
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
    console.error('Lỗi khi lấy mã giảm giá:', error.message);
    return [];
  }
}

// Hàm tóm tắt mã giảm giá
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

// Các hàm khác (thu gọn để tập trung vào mã giảm giá)
async function getActiveProducts() {
  try {
    const response = await fetch(PRODUCTS_API_URL);
    if (!response.ok) throw new Error(`Lỗi từ API sản phẩm: ${response.status}`);
    return await response.json();
  } catch (error) {
    console.error('Lỗi khi lấy sản phẩm:', error);
    return [];
  }
}

async function getBrands() {
  try {
    const response = await fetch(BRANDS_API_URL);
    if (!response.ok) throw new Error(`Lỗi từ API thương hiệu: ${response.status}`);
    const brands = await response.json();
    return brands.filter(brand => brand.status === 'show');
  } catch (error) {
    console.error('Lỗi khi lấy thương hiệu:', error);
    return [];
  }
}

async function getNews() {
  try {
    const response = await fetch(NEWS_API_URL);
    if (!response.ok) throw new Error(`Lỗi từ API tin tức: ${response.status}`);
    const news = await response.json();
    return news.filter(item => item.status === 'show').slice(0, 3);
  } catch (error) {
    console.error('Lỗi khi lấy tin tức:', error);
    return [];
  }
}

async function getCategories() {
  try {
    const response = await fetch(CATEGORIES_API_URL);
    if (!response.ok) throw new Error(`Lỗi từ API danh mục: ${response.status}`);
    const categories = await response.json();
    return categories.filter(category => category.status === 'show');
  } catch (error) {
    console.error('Lỗi khi lấy danh mục:', error);
    return [];
  }
}

function filterProducts(products, keyword) {
  if (!keyword) return products.slice(0, 5);
  const lowerKeyword = keyword.toLowerCase();
  return products
    .filter(product =>
      product.name.toLowerCase().includes(lowerKeyword) ||
      product.short_description.toLowerCase().includes(lowerKeyword) ||
      product.description.toLowerCase().includes(lowerKeyword)
    )
    .slice(0, 3);
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
    return `Sản phẩm: ${product.name}\nMô tả ngắn: ${product.short_description}\nChi tiết: ${product.description.substring(0, 200)}...\n${option}\n${images}\n`;
  }).join('\n---\n');
}

function summarizeBrands(brands) {
  if (brands.length === 0) return 'Không có thương hiệu nào hiện tại.';
  return brands.map(brand => `Thương hiệu: ${brand.name}\nLogo: ${brand.logoImg || 'Không có logo'}\n`).join('\n---\n');
}

function summarizeNews(news) {
  if (news.length === 0) return 'Hiện tại chưa có tin tức nào.';
  return news.map(item => `Tiêu đề: ${item.title}\nNgày đăng: ${new Date(item.publishedAt).toLocaleDateString('vi-VN')}\nLượt xem: ${item.views}\nTóm tắt: ${item.content.substring(0, 100)}...\n`).join('\n---\n');
}

function summarizeCategories(categories) {
  if (categories.length === 0) return 'Không có danh mục nào hiện tại.';
  return categories.map(category => `Danh mục: ${category.name}\n`).join('\n---\n');
}

// Danh sách FAQ
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

    // Kiểm tra FAQ
    const faqMatch = faqs.find(faq => faq.question.toLowerCase() === message.toLowerCase());
    if (faqMatch) {
      if (faqMatch.question.toLowerCase().includes('mã giảm giá') || faqMatch.question.toLowerCase().includes('coupon') || faqMatch.question.toLowerCase().includes('khuyến mãi')) {
        hasCouponQuery = true;
        suggestedCoupons = await getCoupons();
        botResponseText = suggestedCoupons.length > 0
          ? `Chào bạn! Hiện tại shop có các mã giảm giá:\n${summarizeCoupons(suggestedCoupons)}\nHãy nhanh tay áp dụng khi mua sắm nhé!`
          : 'Chào bạn! Hiện tại chưa có mã giảm giá nào hợp lệ. Hãy theo dõi trang web và fanpage của Pure Botanice để cập nhật các chương trình khuyến mãi mới!';
      } else {
        botResponseText = typeof faqMatch.answer === 'function' ? await faqMatch.answer() : `${faqMatch.answer}`;
      }
    } else {
      // Xử lý từ khóa để phát hiện câu hỏi không thuộc FAQ
      const productKeywords = ['sản phẩm', 'gợi ý', 'mua', 'kem', 'mặt nạ', 'toner', 'chống nắng', 'da'];
      const brandKeywords = ['thương hiệu', 'brand'];
      const couponKeywords = ['mã giảm giá', 'coupon', 'khuyến mãi'];
      const newsKeywords = ['tin tức', 'news', 'bài viết'];
      const categoryKeywords = ['danh mục', 'category'];

      hasProductQuery = productKeywords.some(keyword => message.toLowerCase().includes(keyword));
      hasBrandQuery = brandKeywords.some(keyword => message.toLowerCase().includes(keyword));
      hasCouponQuery = couponKeywords.some(keyword => message.toLowerCase().includes(keyword));
      hasNewsQuery = newsKeywords.some(keyword => message.toLowerCase().includes(keyword));
      hasCategoryQuery = categoryKeywords.some(keyword => message.toLowerCase().includes(keyword));

      let context = '';
      if (hasProductQuery) {
        console.log('Phát hiện yêu cầu gợi ý sản phẩm...');
        const products = await getActiveProducts();
        suggestedProducts = filterProducts(products, message);
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
        // Ghi đè botResponseText để đảm bảo đồng bộ
        botResponseText = suggestedCoupons.length > 0
          ? `Chào bạn! Hiện tại shop có các mã giảm giá:\n${summarizeCoupons(suggestedCoupons)}\nHãy nhanh tay áp dụng khi mua sắm nhé!`
          : 'Chào bạn! Hiện tại chưa có mã giảm giá nào hợp lệ. Hãy theo dõi trang web và fanpage của Pure Botanice để cập nhật các chương trình khuyến mãi mới!';
      }
      if (hasNewsQuery) {
        console.log('Phát hiện yêu cầu về tin tức...');
        suggestedNews = await getNews();
        context += `Danh sách tin tức mới nhất: ${summarizeNews(suggestedNews)}\n\n`;
      }
      if (hasCategoryQuery) {
        console.log('Phát hiện yêu cầu về danh mục...');
        suggestedCategories = await getCategories();
        context += `Danh sách danh mục hiện có: ${summarizeCategories(suggestedCategories)}\n\n`;
      }

      // Chỉ gọi Gemini API nếu không có mã giảm giá hoặc không có FAQ khớp
      if (!faqMatch && !botResponseText) {
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
        botResponseText = `${botResponseText}`;
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