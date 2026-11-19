/* Vercel serverless function: hands the PUBLIC Supabase URL + anon/publishable key
   (stored in Vercel Environment Variables) to the browser. No keys live in GitHub. */
module.exports = function (req, res) {
  var env = process.env;
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-store');
  res.status(200).send(JSON.stringify({
    url: env.SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL || '',
    key: env.SUPABASE_ANON_KEY || env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
  }));
};
