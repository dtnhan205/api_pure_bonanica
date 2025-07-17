const Contact = require('../models/contact');

exports.createContact = async (req, res) => {
  try {
    const { fullName, email, phone, message } = req.body;

    if (!fullName || !email) {
      return res.status(400).json({ message: 'Họ và tên và email là bắt buộc' });
    }

    const newContact = new Contact({
      fullName,
      email,
      phone: phone || '',   
      message: message || '',
    });

    await newContact.save();

    res.status(201).json({ message: 'Gửi liên hệ thành công', contact: newContact });
  } catch (error) {
    console.error('Lỗi khi gửi liên hệ:', error.message, error.stack);
    res.status(500).json({ message: 'Lỗi server khi gửi liên hệ' });
  }
};

exports.getAllContacts = async (req, res) => {
  try {
    const contacts = await Contact.find().sort({ createdAt: -1 });
    res.status(200).json({ contacts, totalPages: 1 });
  } catch (error) {
    console.error('Lỗi khi lấy danh sách liên hệ:', error.message, error.stack);
    res.status(500).json({ message: 'Lỗi server khi lấy danh sách liên hệ' });
  }
};

exports.getContactById = async (req, res) => {
  try {
    const contact = await Contact.findById(req.params.id);
    if (!contact) {
      return res.status(404).json({ message: 'Liên hệ không tồn tại' });
    }
    res.status(200).json(contact);
  } catch (error) {
    console.error('Lỗi khi lấy thông tin liên hệ:', error.message, error.stack);
    res.status(500).json({ message: 'Lỗi server khi lấy thông tin liên hệ' });
  }
};

exports.updateContact = async (req, res) => {
  try {
    const { status } = req.body;
    const contact = await Contact.findById(req.params.id);

    if (!contact) {
      return res.status(404).json({ message: 'Liên hệ không tồn tại' });
    }

    if (status !== 'Đã xử lý' && status !== 'Chưa xử lý') {
      return res.status(400).json({ message: 'Trạng thái không hợp lệ. Chỉ cho phép "Chưa xử lý" hoặc "Đã xử lý".' });
    }

    if (contact.status === 'Đã xử lý') {
      return res.status(400).json({ message: 'Liên hệ đã được xử lý, không thể cập nhật lại trạng thái.' });
    }

    if (status === 'Đã xử lý' && contact.status === 'Chưa xử lý') {
      contact.status = status;
    } else {
      return res.status(400).json({ message: 'Chỉ có thể cập nhật trạng thái từ "Chưa xử lý" thành "Đã xử lý".' });
    }

    await contact.save();
    res.status(200).json({ message: 'Cập nhật trạng thái thành công', contact });
  } catch (error) {
    console.error('Lỗi khi cập nhật trạng thái liên hệ:', error.message, error.stack);
    res.status(500).json({ message: 'Lỗi server khi cập nhật trạng thái liên hệ' });
  }
};

exports.deleteContact = async (req, res) => {
  try {
    const contact = await Contact.findById(req.params.id);
    if (!contact) {
      return res.status(404).json({ message: 'Liên hệ không tồn tại' });
    }

    await contact.deleteOne();
    res.status(200).json({ message: 'Xóa liên hệ thành công' });
  } catch (error) {
    console.error('Lỗi khi xóa liên hệ:', error.message, error.stack);
    res.status(500).json({ message: 'Lỗi server khi xóa liên hệ' });
  }
};