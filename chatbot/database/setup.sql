-- Create database
CREATE DATABASE IF NOT EXISTS chatbot_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

USE chatbot_db;

-- Available languages
CREATE TABLE IF NOT EXISTS languages (
  id INT AUTO_INCREMENT PRIMARY KEY,
  code VARCHAR(10) NOT NULL UNIQUE,
  name VARCHAR(50) NOT NULL,
  native_name VARCHAR(50) NOT NULL,
  is_active TINYINT(1) DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Users table - stores user info and selected language
CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  phone VARCHAR(100) NOT NULL UNIQUE,
  name VARCHAR(100) DEFAULT NULL,
  language_code VARCHAR(10) DEFAULT NULL,
  current_level VARCHAR(50) DEFAULT 'welcome',
  current_step VARCHAR(50) DEFAULT 'start',
  is_active TINYINT(1) DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (language_code) REFERENCES languages(code) ON UPDATE CASCADE
);

-- Conversation sessions
CREATE TABLE IF NOT EXISTS conversations (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  session_id VARCHAR(100) NOT NULL,
  status ENUM('active', 'completed', 'abandoned') DEFAULT 'active',
  started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  ended_at TIMESTAMP NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Message logs
CREATE TABLE IF NOT EXISTS messages (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  conversation_id INT DEFAULT NULL,
  user_id INT NOT NULL,
  direction ENUM('incoming', 'outgoing') NOT NULL,
  message_type VARCHAR(20) DEFAULT 'text',
  content TEXT NOT NULL,
  channel VARCHAR(20) DEFAULT 'whatsapp',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE SET NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Bot flow levels (multi-level bot structure)
CREATE TABLE IF NOT EXISTS bot_flows (
  id INT AUTO_INCREMENT PRIMARY KEY,
  level VARCHAR(50) NOT NULL,
  step VARCHAR(50) NOT NULL,
  language_code VARCHAR(10) NOT NULL,
  message_text TEXT NOT NULL,
  message_type ENUM('text', 'interactive_list', 'interactive_button') DEFAULT 'text',
  options JSON DEFAULT NULL,
  file_url VARCHAR(500) DEFAULT NULL,
  next_level VARCHAR(50) DEFAULT NULL,
  next_step VARCHAR(50) DEFAULT NULL,
  parent_option VARCHAR(100) DEFAULT NULL,
  is_active TINYINT(1) DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY unique_flow (level, step, language_code, parent_option),
  FOREIGN KEY (language_code) REFERENCES languages(code) ON UPDATE CASCADE
);

-- Admin users table
CREATE TABLE IF NOT EXISTS admin_users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(50) NOT NULL UNIQUE,
  password VARCHAR(255) NOT NULL,
  name VARCHAR(100) NOT NULL,
  role ENUM('admin', 'user') DEFAULT 'user',
  is_active TINYINT(1) DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Insert default admin users (admin/admin123, user/user123)
INSERT INTO admin_users (username, password, name, role) VALUES
  ('admin', SHA2('admin123', 256), 'Administrator', 'admin'),
  ('user', SHA2('user123', 256), 'Normal User', 'user')
ON DUPLICATE KEY UPDATE name = VALUES(name);

-- Insert default languages
INSERT INTO languages (code, name, native_name) VALUES
  ('en', 'English', 'English'),
  ('hi', 'Hindi', 'हिन्दी'),
  ('ta', 'Tamil', 'தமிழ்'),
  ('te', 'Telugu', 'తెలుగు'),
  ('kn', 'Kannada', 'ಕನ್ನಡ'),
  ('mr', 'Marathi', 'मराठी')
ON DUPLICATE KEY UPDATE name = VALUES(name);

-- Insert default bot flow messages (English)
INSERT INTO bot_flows (level, step, language_code, message_text, message_type, options, next_level, next_step) VALUES
  ('welcome', 'start', 'en', 'Welcome to Vivek Bot! 🙏\nPlease select your preferred language:', 'interactive_list',
   '[{"id":"lang_en","title":"English","description":"Continue in English"},{"id":"lang_hi","title":"हिन्दी","description":"Continue in Hindi"},{"id":"lang_ta","title":"தமிழ்","description":"Continue in Tamil"},{"id":"lang_te","title":"తెలుగు","description":"Continue in Telugu"},{"id":"lang_kn","title":"ಕನ್ನಡ","description":"Continue in Kannada"},{"id":"lang_mr","title":"मराठी","description":"Continue in Marathi"}]',
   'main_menu', 'start'),
  ('main_menu', 'start', 'en', 'Please select a service from the menu below:', 'interactive_list',
   '[{"id":"opt_driving_licence","title":"Driving Licence","description":"Apply, renew or check DL status"},{"id":"opt_vehicle","title":"Vehicle","description":"Vehicle registration & related services"},{"id":"opt_challan","title":"Challan","description":"Check & pay traffic challans"},{"id":"opt_permit","title":"Permit","description":"Apply for transport permits"},{"id":"opt_faceless","title":"Faceless","description":"Faceless RTO services"},{"id":"opt_info_help","title":"Information and Help","description":"Get information & help"},{"id":"opt_others","title":"Others","description":"Other services & queries"}]',
   NULL, NULL),
  ('driving_licence', 'start', 'en', 'Driving Licence Services:', 'interactive_list',
   '[{"id":"dl_learner","title":"Learner''s Licence","description":"Apply for a learner''s licence"},{"id":"dl_permanent","title":"Permanent Licence","description":"Apply for permanent driving licence"},{"id":"dl_renewal","title":"Licence Renewal","description":"Renew your driving licence"},{"id":"dl_duplicate","title":"Duplicate Licence","description":"Get a duplicate licence copy"},{"id":"dl_add_class","title":"Add New Vehicle Class","description":"Add a new vehicle class to DL"},{"id":"dl_address","title":"Licence Address Change","description":"Change address on your licence"},{"id":"dl_name_correction","title":"Correction of Name","description":"Correct name on your licence"},{"id":"dl_questions","title":"Licence Related Ques.","description":"Common licence related questions"},{"id":"dl_back","title":"⬅ Back to Menu","description":"Return to main menu"}]',
   NULL, NULL),
  ('vehicle', 'start', 'en', 'Vehicle Services:', 'interactive_list',
   '[{"id":"veh_register","title":"New Registration","description":"Register a new vehicle"},{"id":"veh_transfer","title":"Transfer of Ownership","description":"Transfer vehicle ownership"},{"id":"veh_noc","title":"NOC","description":"Apply for No Objection Certificate"},{"id":"veh_status","title":"Check RC Status","description":"Track your RC application"},{"id":"veh_back","title":"⬅ Back to Menu","description":"Return to main menu"}]',
   NULL, NULL),
  ('challan', 'start', 'en', 'Challan Services:', 'interactive_list',
   '[{"id":"ch_check","title":"Check Challan","description":"Check pending challans by vehicle number"},{"id":"ch_pay","title":"Pay Challan","description":"Pay your traffic challan online"},{"id":"ch_history","title":"Challan History","description":"View past challan records"},{"id":"ch_back","title":"⬅ Back to Menu","description":"Return to main menu"}]',
   NULL, NULL),
  ('permit', 'start', 'en', 'Permit Services:', 'interactive_list',
   '[{"id":"pm_apply","title":"Apply for Permit","description":"Apply for a new transport permit"},{"id":"pm_renew","title":"Renew Permit","description":"Renew your existing permit"},{"id":"pm_status","title":"Check Permit Status","description":"Track your permit application"},{"id":"pm_back","title":"⬅ Back to Menu","description":"Return to main menu"}]',
   NULL, NULL),
  ('faceless', 'start', 'en', 'Faceless RTO Services:', 'interactive_list',
   '[{"id":"fl_apply","title":"Apply Online","description":"Submit applications without visiting RTO"},{"id":"fl_status","title":"Application Status","description":"Check your faceless application status"},{"id":"fl_docs","title":"Document Upload","description":"Upload required documents"},{"id":"fl_back","title":"⬅ Back to Menu","description":"Return to main menu"}]',
   NULL, NULL),
  ('info_help', 'start', 'en', 'Information and Help:', 'interactive_list',
   '[{"id":"ih_faq","title":"FAQ","description":"Frequently asked questions"},{"id":"ih_rto","title":"RTO Office Info","description":"Find nearest RTO office"},{"id":"ih_docs","title":"Required Documents","description":"List of documents needed"},{"id":"ih_contact","title":"Contact Support","description":"Speak with our team"},{"id":"ih_back","title":"⬅ Back to Menu","description":"Return to main menu"}]',
   NULL, NULL),
  ('others', 'start', 'en', 'Other Services:', 'interactive_list',
   '[{"id":"ot_feedback","title":"Feedback","description":"Share your feedback"},{"id":"ot_complaint","title":"File Complaint","description":"Register a complaint"},{"id":"ot_language","title":"Change Language","description":"Switch to another language"},{"id":"ot_back","title":"⬅ Back to Menu","description":"Return to main menu"}]',
   NULL, NULL)
ON DUPLICATE KEY UPDATE message_text = VALUES(message_text);

-- Insert default bot flow messages (Hindi)
INSERT INTO bot_flows (level, step, language_code, message_text, message_type, options, next_level, next_step) VALUES
  ('main_menu', 'start', 'hi', 'कृपया नीचे दिए गए मेनू से एक सेवा चुनें:', 'interactive_list',
   '[{"id":"opt_driving_licence","title":"ड्राइविंग लाइसेंस","description":"DL के लिए आवेदन, नवीनीकरण या स्थिति जांचें"},{"id":"opt_vehicle","title":"वाहन","description":"वाहन पंजीकरण और संबंधित सेवाएं"},{"id":"opt_challan","title":"चालान","description":"ट्रैफिक चालान जांचें और भुगतान करें"},{"id":"opt_permit","title":"परमिट","description":"परिवहन परमिट के लिए आवेदन करें"},{"id":"opt_faceless","title":"फेसलेस","description":"फेसलेस RTO सेवाएं"},{"id":"opt_info_help","title":"जानकारी और सहायता","description":"जानकारी और मदद प्राप्त करें"},{"id":"opt_others","title":"अन्य","description":"अन्य सेवाएं और प्रश्न"}]',
   NULL, NULL),
  ('driving_licence', 'start', 'hi', 'ड्राइविंग लाइसेंस सेवाएं:', 'interactive_list',
   '[{"id":"dl_learner","title":"लर्नर लाइसेंस","description":"लर्नर लाइसेंस के लिए आवेदन करें"},{"id":"dl_permanent","title":"स्थायी लाइसेंस","description":"स्थायी ड्राइविंग लाइसेंस के लिए आवेदन"},{"id":"dl_renewal","title":"लाइसेंस नवीनीकरण","description":"अपना ड्राइविंग लाइसेंस नवीनीकृत करें"},{"id":"dl_duplicate","title":"डुप्लीकेट लाइसेंस","description":"डुप्लीकेट लाइसेंस प्राप्त करें"},{"id":"dl_add_class","title":"नया वाहन वर्ग जोड़ें","description":"DL में नया वाहन वर्ग जोड़ें"},{"id":"dl_address","title":"पता परिवर्तन","description":"लाइसेंस पर पता बदलें"},{"id":"dl_name_correction","title":"नाम सुधार","description":"लाइसेंस पर नाम सुधारें"},{"id":"dl_questions","title":"लाइसेंस संबंधित प्रश्न","description":"सामान्य लाइसेंस संबंधित प्रश्न"},{"id":"dl_back","title":"⬅ मेनू पर वापस","description":"मुख्य मेनू पर लौटें"}]',
   NULL, NULL),
  ('vehicle', 'start', 'hi', 'वाहन सेवाएं:', 'interactive_list',
   '[{"id":"veh_register","title":"नया पंजीकरण","description":"नए वाहन का पंजीकरण करें"},{"id":"veh_transfer","title":"स्वामित्व हस्तांतरण","description":"वाहन का स्वामित्व हस्तांतरित करें"},{"id":"veh_noc","title":"NOC","description":"अनापत्ति प्रमाणपत्र के लिए आवेदन"},{"id":"veh_status","title":"RC स्थिति जांचें","description":"अपने RC आवेदन को ट्रैक करें"},{"id":"veh_back","title":"⬅ मेनू पर वापस","description":"मुख्य मेनू पर लौटें"}]',
   NULL, NULL),
  ('challan', 'start', 'hi', 'चालान सेवाएं:', 'interactive_list',
   '[{"id":"ch_check","title":"चालान जांचें","description":"वाहन नंबर से लंबित चालान जांचें"},{"id":"ch_pay","title":"चालान भुगतान","description":"ऑनलाइन ट्रैफिक चालान का भुगतान करें"},{"id":"ch_history","title":"चालान इतिहास","description":"पिछले चालान रिकॉर्ड देखें"},{"id":"ch_back","title":"⬅ मेनू पर वापस","description":"मुख्य मेनू पर लौटें"}]',
   NULL, NULL),
  ('permit', 'start', 'hi', 'परमिट सेवाएं:', 'interactive_list',
   '[{"id":"pm_apply","title":"परमिट आवेदन","description":"नए परिवहन परमिट के लिए आवेदन करें"},{"id":"pm_renew","title":"परमिट नवीनीकरण","description":"अपने मौजूदा परमिट को नवीनीकृत करें"},{"id":"pm_status","title":"परमिट स्थिति","description":"अपने परमिट आवेदन को ट्रैक करें"},{"id":"pm_back","title":"⬅ मेनू पर वापस","description":"मुख्य मेनू पर लौटें"}]',
   NULL, NULL),
  ('faceless', 'start', 'hi', 'फेसलेस RTO सेवाएं:', 'interactive_list',
   '[{"id":"fl_apply","title":"ऑनलाइन आवेदन","description":"RTO जाए बिना आवेदन जमा करें"},{"id":"fl_status","title":"आवेदन स्थिति","description":"फेसलेस आवेदन की स्थिति जांचें"},{"id":"fl_docs","title":"दस्तावेज़ अपलोड","description":"आवश्यक दस्तावेज़ अपलोड करें"},{"id":"fl_back","title":"⬅ मेनू पर वापस","description":"मुख्य मेनू पर लौटें"}]',
   NULL, NULL),
  ('info_help', 'start', 'hi', 'जानकारी और सहायता:', 'interactive_list',
   '[{"id":"ih_faq","title":"सामान्य प्रश्न","description":"अक्सर पूछे जाने वाले प्रश्न"},{"id":"ih_rto","title":"RTO कार्यालय जानकारी","description":"निकटतम RTO कार्यालय खोजें"},{"id":"ih_docs","title":"आवश्यक दस्तावेज़","description":"आवश्यक दस्तावेज़ों की सूची"},{"id":"ih_contact","title":"सहायता से संपर्क","description":"हमारी टीम से बात करें"},{"id":"ih_back","title":"⬅ मेनू पर वापस","description":"मुख्य मेनू पर लौटें"}]',
   NULL, NULL),
  ('others', 'start', 'hi', 'अन्य सेवाएं:', 'interactive_list',
   '[{"id":"ot_feedback","title":"प्रतिक्रिया","description":"अपनी प्रतिक्रिया साझा करें"},{"id":"ot_complaint","title":"शिकायत दर्ज करें","description":"शिकायत दर्ज करें"},{"id":"ot_language","title":"भाषा बदलें","description":"दूसरी भाषा में स्विच करें"},{"id":"ot_back","title":"⬅ मेनू पर वापस","description":"मुख्य मेनू पर लौटें"}]',
   NULL, NULL)
ON DUPLICATE KEY UPDATE message_text = VALUES(message_text);
