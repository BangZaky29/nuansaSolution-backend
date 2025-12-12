-- phpMyAdmin SQL Dump
-- version 5.2.1
-- https://www.phpmyadmin.net/
--
-- Host: 127.0.0.1
-- Generation Time: Dec 12, 2025 at 11:53 AM
-- Server version: 10.4.32-MariaDB
-- PHP Version: 8.2.12

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

--
-- Database: `gateway`
--

-- --------------------------------------------------------

--
-- Table structure for table `orders`
--

CREATE TABLE `orders` (
  `id` bigint(20) NOT NULL,
  `user_id` int(11) NOT NULL,
  `order_id` varchar(50) NOT NULL,
  `package_name` varchar(50) DEFAULT NULL,
  `gross_amount` decimal(15,2) NOT NULL,
  `status` enum('pending','paid','expired','failed') DEFAULT 'pending',
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NULL DEFAULT NULL,
  `expiry_date` datetime DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `orders`
--

INSERT INTO `orders` (`id`, `user_id`, `order_id`, `package_name`, `gross_amount`, `status`, `created_at`, `updated_at`, `expiry_date`) VALUES
(1, 1, 'ORD-EXPIRED-1', 'Paket A', 50000.00, 'paid', '2025-12-01 03:00:00', NULL, '2025-12-05 10:00:00'),
(2, 2, 'ORD-ACTIVE-2', 'Paket B', 75000.00, 'paid', '2025-12-10 03:00:00', NULL, '2025-12-25 10:00:00');

-- --------------------------------------------------------

--
-- Table structure for table `otp_codes`
--

CREATE TABLE `otp_codes` (
  `id` int(11) NOT NULL,
  `user_id` int(11) NOT NULL,
  `otp_code` varchar(6) NOT NULL,
  `expires_at` datetime NOT NULL,
  `created_at` datetime DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `payments`
--

CREATE TABLE `payments` (
  `id` bigint(20) NOT NULL,
  `order_id` varchar(50) NOT NULL,
  `user_id` int(11) NOT NULL,
  `payment_method` enum('va_bca','qris') NOT NULL,
  `va_number` varchar(50) DEFAULT NULL,
  `transaction_id` varchar(100) DEFAULT NULL,
  `transaction_status` varchar(50) DEFAULT NULL,
  `gross_amount` decimal(15,2) NOT NULL,
  `expiry_time` datetime DEFAULT NULL,
  `raw_response` longtext DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NULL DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `users`
--

CREATE TABLE `users` (
  `id` int(11) NOT NULL,
  `email` varchar(255) NOT NULL,
  `phone` varchar(20) NOT NULL,
  `password_hash` varchar(255) NOT NULL,
  `created_at` datetime DEFAULT current_timestamp(),
  `updated_at` datetime DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `users`
--

INSERT INTO `users` (`id`, `email`, `phone`, `password_hash`, `created_at`, `updated_at`) VALUES
(1, 'user1@example.com', '08123456701', 'hashedpass1', '2025-12-11 23:15:59', '2025-12-11 23:15:59'),
(2, 'user2@example.com', '08123456702', 'hashedpass2', '2025-12-11 23:15:59', '2025-12-11 23:15:59'),
(5, 'bangzaky0029@gmail.com', '08123456789', '$2b$10$ufiU2sGU9YGekOrKseCFBOUkgRMPGa3FzH0HJ8ZjaBnNcl38z4fmO', '2025-12-12 13:14:55', '2025-12-12 13:14:55'),
(6, 'bangzaky029@gmail.com', '08123456789', '$2b$10$QcYXQ930WjDsbgvFxDSdj.nRhYVm7vwSjZLpcm4iffP11TSJJx7vy', '2025-12-12 14:24:01', '2025-12-12 14:24:01'),
(7, 'bangzaky28@gmail.com', '081995770190', '$2b$10$hWVJVpKY4Gjlqth3wC4nmu.RwGchCoqz5ECIO893CgSsp0.fg8Vfu', '2025-12-12 15:42:13', '2025-12-12 15:42:13'),
(8, 'bangzaky9@gmail.com', '081995770190', '$2b$10$73NwrhsAsbc5LCZvWYXAfeqPFmnGDz4xw3NquMvc7Mvn/ik6N4z5C', '2025-12-12 16:04:57', '2025-12-12 16:04:57');

-- --------------------------------------------------------

--
-- Table structure for table `user_sessions`
--

CREATE TABLE `user_sessions` (
  `id` int(11) NOT NULL,
  `user_id` int(11) NOT NULL,
  `login_at` datetime DEFAULT current_timestamp(),
  `logout_at` datetime DEFAULT NULL,
  `ip_address` varchar(50) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `user_sessions`
--

INSERT INTO `user_sessions` (`id`, `user_id`, `login_at`, `logout_at`, `ip_address`) VALUES
(1, 5, '2025-12-12 13:46:24', NULL, '::1'),
(2, 6, '2025-12-12 14:24:20', NULL, '::1'),
(3, 6, '2025-12-12 15:32:41', NULL, '::1'),
(4, 5, '2025-12-12 15:41:52', NULL, '::1'),
(5, 7, '2025-12-12 15:42:21', NULL, '::1'),
(6, 5, '2025-12-12 15:59:39', NULL, '::1'),
(7, 5, '2025-12-12 15:59:45', NULL, '::1'),
(8, 5, '2025-12-12 15:59:48', NULL, '::1'),
(9, 5, '2025-12-12 15:59:50', NULL, '::1'),
(10, 5, '2025-12-12 15:59:50', NULL, '::1'),
(11, 5, '2025-12-12 16:00:06', NULL, '::1'),
(12, 5, '2025-12-12 16:03:13', NULL, '::1'),
(13, 5, '2025-12-12 16:03:40', NULL, '::1'),
(14, 5, '2025-12-12 16:03:43', NULL, '::1'),
(15, 8, '2025-12-12 16:05:13', '2025-12-12 16:12:13', '::1'),
(16, 8, '2025-12-12 16:05:18', '2025-12-12 16:12:13', '::1'),
(17, 8, '2025-12-12 16:05:26', '2025-12-12 16:12:13', '::1'),
(18, 8, '2025-12-12 16:05:31', '2025-12-12 16:12:13', '::1'),
(19, 8, '2025-12-12 16:12:04', '2025-12-12 16:12:13', '::1'),
(20, 5, '2025-12-12 16:12:29', NULL, '::1');

--
-- Indexes for dumped tables
--

--
-- Indexes for table `orders`
--
ALTER TABLE `orders`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `order_id` (`order_id`),
  ADD KEY `user_id` (`user_id`);

--
-- Indexes for table `otp_codes`
--
ALTER TABLE `otp_codes`
  ADD PRIMARY KEY (`id`),
  ADD KEY `user_id` (`user_id`);

--
-- Indexes for table `payments`
--
ALTER TABLE `payments`
  ADD PRIMARY KEY (`id`),
  ADD KEY `user_id` (`user_id`),
  ADD KEY `order_id` (`order_id`);

--
-- Indexes for table `users`
--
ALTER TABLE `users`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `email` (`email`);

--
-- Indexes for table `user_sessions`
--
ALTER TABLE `user_sessions`
  ADD PRIMARY KEY (`id`),
  ADD KEY `user_id` (`user_id`);

--
-- AUTO_INCREMENT for dumped tables
--

--
-- AUTO_INCREMENT for table `orders`
--
ALTER TABLE `orders`
  MODIFY `id` bigint(20) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=3;

--
-- AUTO_INCREMENT for table `otp_codes`
--
ALTER TABLE `otp_codes`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `payments`
--
ALTER TABLE `payments`
  MODIFY `id` bigint(20) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `users`
--
ALTER TABLE `users`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=9;

--
-- AUTO_INCREMENT for table `user_sessions`
--
ALTER TABLE `user_sessions`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=21;

--
-- Constraints for dumped tables
--

--
-- Constraints for table `orders`
--
ALTER TABLE `orders`
  ADD CONSTRAINT `orders_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`);

--
-- Constraints for table `otp_codes`
--
ALTER TABLE `otp_codes`
  ADD CONSTRAINT `otp_codes_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`);

--
-- Constraints for table `payments`
--
ALTER TABLE `payments`
  ADD CONSTRAINT `payments_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`),
  ADD CONSTRAINT `payments_ibfk_2` FOREIGN KEY (`order_id`) REFERENCES `orders` (`order_id`);

--
-- Constraints for table `user_sessions`
--
ALTER TABLE `user_sessions`
  ADD CONSTRAINT `user_sessions_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`);
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
