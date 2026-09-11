const { pool } = require('../config/db');

exports.getKeywords = async (req, res) => {
  try {
    const { id } = req.params; // business id
    const [rows] = await pool.query(
      `SELECT id, business_id, keyword, status, created_at, updated_at
       FROM business_keywords WHERE business_id = ? ORDER BY created_at DESC`,
      [id]
    );
    res.json({ success: true, keywords: rows });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

exports.addKeyword = async (req, res) => {
    try {
      const { id } = req.params; // business id — already ownership-checked by requireBusinessOwnership
      const { keyword } = req.body;
      console.log('[addKeyword] business_id:', id, 'keyword:', keyword, 'user:', req.user); // TEMP
      if (!keyword?.trim()) {
        return res.status(400).json({ success: false, message: 'keyword is required' });
      }
      const [result] = await pool.query(
        `INSERT INTO business_keywords (business_id, keyword, created_by) VALUES (?, ?, ?)`,
        [id, keyword.trim(), req.user.id]
      );
      console.log('[addKeyword] insert result:', result); 
    res.status(201).json({
      success: true,
      keyword: { id: result.insertId, business_id: id, keyword: keyword.trim(), status: 'active' },
    });
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({ success: false, message: 'This keyword already exists for this business' });
    }
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

exports.updateKeyword = async (req, res) => {
  try {
    const { id, keywordId } = req.params; // business id + keyword id
    const { keyword } = req.body;
    if (!keyword?.trim()) {
      return res.status(400).json({ success: false, message: 'keyword is required' });
    }
    const [result] = await pool.query(
      `UPDATE business_keywords SET keyword = ? WHERE id = ? AND business_id = ?`,
      [keyword.trim(), keywordId, id]
    );
    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: 'Keyword not found' });
    }
    res.json({ success: true, message: 'Keyword updated' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

exports.deleteKeyword = async (req, res) => {
    try {
      const { id, keywordId } = req.params;
      const [result] = await pool.query(
        `DELETE FROM business_keywords WHERE id = ? AND business_id = ?`,
        [keywordId, id]
      );
      if (result.affectedRows === 0) {
        return res.status(404).json({ success: false, message: 'Keyword not found' });
      }
      res.json({ success: true, message: 'Keyword deleted' });
    } catch (error) {
      res.status(500).json({ success: false, message: 'Server error', error: error.message });
    }
  };
  
  // Public: read-only, no auth — used on the review form's "What did you like?" chips
  exports.getPublicKeywords = async (req, res) => {
    try {
      const { id } = req.params; // business id
      const [rows] = await pool.query(
        `SELECT keyword FROM business_keywords WHERE business_id = ? AND status = 'active' ORDER BY created_at DESC`,
        [id]
      );
      res.json({ success: true, keywords: rows.map((r) => r.keyword) });
    } catch (error) {
      res.status(500).json({ success: false, message: 'Server error', error: error.message });
    }
  };