// backend/src/controllers/feature.controller.js
const featureService = require('../services/feature.service');
const { setFeatureMetadata } = require('../middlewares/feature.middleware');

class FeatureController {
  /**
   * GET /api/features
   * Get all available features
   */
  async getAllFeatures(req, res) {
    try {
      const features = await featureService.getAllFeatures();

      res.json({
        success: true,
        data: features
      });

    } catch (error) {
      console.error('Get features error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get features'
      });
    }
  }

  /**
   * GET /api/features/my-subscription
   * Get user's active subscription with feature access
   */
  async getMySubscription(req, res) {
    try {
      const userId = req.user.user_id;
      const subscription = await featureService.getUserSubscription(userId);

      if (!subscription) {
        return res.json({
          success: true,
          has_subscription: false,
          message: 'No active subscription',
          data: null
        });
      }

      res.json({
        success: true,
        has_subscription: true,
        data: subscription
      });

    } catch (error) {
      console.error('Get my subscription error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get subscription'
      });
    }
  }

  /**
   * GET /api/features/usage-history
   * Get user's feature usage history
   */
  async getUsageHistory(req, res) {
    try {
      const userId = req.user.user_id;
      const limit = parseInt(req.query.limit) || 50;

      const history = await featureService.getUserFeatureHistory(userId, limit);

      res.json({
        success: true,
        data: history
      });

    } catch (error) {
      console.error('Get usage history error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get usage history'
      });
    }
  }

  /**
   * POST /api/features/check-access
   * Check if user has access to specific feature
   */
  async checkFeatureAccess(req, res) {
    try {
      const userId = req.user.user_id;
      const { feature_code } = req.body;

      if (!feature_code) {
        return res.status(400).json({
          success: false,
          message: 'Feature code is required'
        });
      }

      const accessCheck = await featureService.checkFeatureAccess(userId, feature_code);

      res.json({
        success: true,
        feature_code,
        ...accessCheck
      });

    } catch (error) {
      console.error('Check feature access error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to check feature access'
      });
    }
  }
}

// ============================================
// EXAMPLE: Document Generation Controllers
// ============================================

class DocumentController {
  /**
   * POST /api/documents/generate-surat-perjanjian
   * Generate Surat Perjanjian
   * Protected by: requireFeature('SURAT_PERJANJIAN')
   */
  async generateSuratPerjanjian(req, res) {
    try {
      const userId = req.user.user_id;
      const {
        pihak_pertama,
        pihak_kedua,
        jabatan_pertama,
        jabatan_kedua,
        isi_perjanjian,
        tanggal_mulai,
        tanggal_selesai,
        tempat
      } = req.body;

      // Validasi input
      if (!pihak_pertama || !pihak_kedua || !isi_perjanjian) {
        return res.status(400).json({
          success: false,
          message: 'Required fields missing'
        });
      }

      // Generate document (contoh sederhana)
      const document = {
        id: `DOC-${Date.now()}`,
        type: 'surat_perjanjian',
        title: 'SURAT PERJANJIAN KERJA',
        content: this.formatSuratPerjanjian({
          pihak_pertama,
          pihak_kedua,
          jabatan_pertama,
          jabatan_kedua,
          isi_perjanjian,
          tanggal_mulai,
          tanggal_selesai,
          tempat
        }),
        created_by: userId,
        created_at: new Date()
      };

      // Set metadata untuk auto-record usage
      setFeatureMetadata(req, 'generate_surat_perjanjian', {
        document_id: document.id,
        document_type: document.type
      });

      res.json({
        success: true,
        message: 'Document generated successfully',
        data: document,
        remaining_usage: req.feature.remaining_usage
      });

    } catch (error) {
      console.error('Generate surat perjanjian error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to generate document'
      });
    }
  }

  /**
   * Helper: Format Surat Perjanjian
   */
  formatSuratPerjanjian(data) {
    const today = new Date().toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });

    return `
SURAT PERJANJIAN KERJA

Pada hari ini, ${today}, di ${data.tempat || 'tempat yang telah ditentukan'}

Yang bertanda tangan di bawah ini:

1. Nama     : ${data.pihak_pertama}
   Jabatan  : ${data.jabatan_pertama || '-'}
   Selanjutnya disebut sebagai PIHAK PERTAMA

2. Nama     : ${data.pihak_kedua}
   Jabatan  : ${data.jabatan_kedua || '-'}
   Selanjutnya disebut sebagai PIHAK KEDUA

PIHAK PERTAMA dan PIHAK KEDUA secara bersama-sama disebut PARA PIHAK, dengan ini menyatakan telah sepakat untuk mengadakan perjanjian kerja dengan ketentuan sebagai berikut:

${data.isi_perjanjian}

Perjanjian ini berlaku mulai tanggal ${data.tanggal_mulai || 'ditentukan kemudian'} sampai dengan ${data.tanggal_selesai || 'ditentukan kemudian'}.

Demikian surat perjanjian ini dibuat dengan sebenarnya dalam rangkap 2 (dua), bermeterai cukup dan mempunyai kekuatan hukum yang sama.


PIHAK PERTAMA,                  PIHAK KEDUA,



${data.pihak_pertama}           ${data.pihak_kedua}
    `;
  }

  /**
   * POST /api/documents/generate-surat-kuasa
   * Generate Surat Kuasa
   * Protected by: requireFeature('SURAT_KUASA')
   */
  async generateSuratKuasa(req, res) {
    try {
      const userId = req.user.user_id;
      const {
        pemberi_kuasa,
        penerima_kuasa,
        keperluan,
        tempat,
        tanggal
      } = req.body;

      if (!pemberi_kuasa || !penerima_kuasa || !keperluan) {
        return res.status(400).json({
          success: false,
          message: 'Required fields missing'
        });
      }

      const document = {
        id: `DOC-${Date.now()}`,
        type: 'surat_kuasa',
        title: 'SURAT KUASA',
        content: this.formatSuratKuasa({
          pemberi_kuasa,
          penerima_kuasa,
          keperluan,
          tempat,
          tanggal
        }),
        created_by: userId,
        created_at: new Date()
      };

      setFeatureMetadata(req, 'generate_surat_kuasa', {
        document_id: document.id,
        document_type: document.type
      });

      res.json({
        success: true,
        message: 'Document generated successfully',
        data: document,
        remaining_usage: req.feature.remaining_usage
      });

    } catch (error) {
      console.error('Generate surat kuasa error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to generate document'
      });
    }
  }

  /**
   * Helper: Format Surat Kuasa
   */
  formatSuratKuasa(data) {
    return `
SURAT KUASA

Yang bertanda tangan di bawah ini:
Nama    : ${data.pemberi_kuasa}

Dengan ini memberikan kuasa kepada:
Nama    : ${data.penerima_kuasa}

Untuk keperluan:
${data.keperluan}

Demikian surat kuasa ini dibuat untuk dapat dipergunakan sebagaimana mestinya.

${data.tempat || 'Tempat'}, ${data.tanggal || new Date().toLocaleDateString('id-ID')}

Pemberi Kuasa,



${data.pemberi_kuasa}
    `;
  }
}

module.exports = {
  FeatureController: new FeatureController(),
  DocumentController: new DocumentController()
};