'use strict';

const rateLimit = require('express-rate-limit');

/** Strict limiter for the upload endpoint — prevents API cost abuse. */
const uploadLimiter = rateLimit({
  windowMs: 60 * 1000,        // 1 minute
  max: 10,                    // 10 uploads per minute per IP
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many upload requests — please wait a moment and try again.' },
});

/** General API limiter for all other routes. */
const generalLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests — please slow down.' },
});

module.exports = { uploadLimiter, generalLimiter };
