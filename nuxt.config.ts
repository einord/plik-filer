import { resolve } from 'path'

export default defineNuxtConfig({
  compatibilityDate: '2025-03-14',

  modules: [
    '@nuxtjs/i18n',
    '@nuxtjs/color-mode',
    '@vueuse/nuxt',
  ],

  css: ['~/assets/css/main.css'],

  components: [
    { path: '~/components', pathPrefix: false },
  ],

  i18n: {
    locales: [
      { code: 'sv', name: 'Svenska', file: 'sv.json' },
      { code: 'en', name: 'English', file: 'en.json' },
    ],
    defaultLocale: 'sv',
    lazy: true,
    langDir: '../i18n',
    detectBrowserLanguage: {
      useCookie: true,
      cookieKey: 'plik_locale',
      fallbackLocale: 'sv',
    },
    strategy: 'no_prefix',
  },

  colorMode: {
    preference: 'system',
    fallback: 'dark',
    classSuffix: '',
  },

  runtimeConfig: {
    jwtSecret: 'change-this-to-a-random-secret',
    dataPath: './data',
    databasePath: './database/plik.db',
    origin: 'http://localhost:3000',
    public: {
      appName: 'plik Filer',
    },
  },

  nitro: {
    alias: {
      '#db': resolve(__dirname, 'server/database/schema.ts'),
    },
    routeRules: {
      '/api/**': {
        // Allow large file uploads
        maxBodySize: 107_374_182_400, // 100 GB
      },
    },
  },
})
