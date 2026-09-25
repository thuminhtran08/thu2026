TDC MP4 FIX

1. Replace src/app/page.tsx with page.tsx
2. Replace src/app/api/send-cake/route.ts with route.ts
3. Install runtime encoder once:
   npm install ffmpeg-static
4. Run:
   npm run dev

Changes:
- Email attachment is MP4, not GIF.
- Download button downloads MP4.
- Message limit backend aligned to 300 chars.
- Removed visible “Về trang chủ” ending button. Click TDC logo to return home.
- Header nav font forced back to clean sans-serif without touching quiz/send-form typography.
- Existing send form and ending star scene preserved.
