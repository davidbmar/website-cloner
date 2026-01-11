# How to Test the CNN Clone

**Quick Answer**: Open this URL in your browser:
```
http://my-landing-page-1768022354.s3-website-us-east-1.amazonaws.com/cnn-clone/
```

---

## Browser Testing (Easiest)

### 1. Open the Site

Just click or paste this URL into your browser:
```
http://my-landing-page-1768022354.s3-website-us-east-1.amazonaws.com/cnn-clone/
```

### 2. Click Around

- Click on **Business**, **Politics**, **World**, etc. in the navigation
- All section pages should load
- Images load from CNN's servers (this is normal)
- Some JavaScript features won't work (expected - this is a static clone)

### 3. Test 404 Page

Visit a non-existent page:
```
http://my-landing-page-1768022354.s3-website-us-east-1.amazonaws.com/cnn-clone/this-page-does-not-exist.html
```

You should see a nice purple custom 404 page.

---

## Command Line Testing

### Quick Test
```bash
curl -I http://my-landing-page-1768022354.s3-website-us-east-1.amazonaws.com/cnn-clone/
```

**Expected**: `HTTP/1.1 200 OK`

### Run Full Test Suite
```bash
/tmp/test-cnn-links.sh
```

**Expected Output**:
```
✅ ALL TESTS PASSED - CNN clone is working correctly!
```

---

## What Should Work

✅ **Homepage loads** (CNN.com main page)
✅ **Section pages work** (Business, Politics, World, Climate, Sports, etc.)
✅ **Navigation menu** (click links to navigate)
✅ **Article pages** (individual news articles)
✅ **Custom 404 page** (beautiful error page for missing content)
✅ **Responsive design** (works on mobile, tablet, desktop)

---

## What Won't Work (Expected)

❌ **Search functionality** (requires backend)
❌ **Login/signup forms** (requires authentication)
❌ **Comments** (requires database)
❌ **Live updates** (this is a snapshot from 2026-01-11)
❌ **Video players** (may or may not work depending on embedding)
❌ **Interactive features** (polls, quizzes, etc.)

This is a **static clone**, so only the HTML pages and linked assets work. All dynamic features that require JavaScript, APIs, or backend services will not function.

---

## Test Results

See full test report: [CNN_CLONE_VERIFIED.md](./CNN_CLONE_VERIFIED.md)

**Summary**:
- ✅ 147 HTML pages deployed
- ✅ 290 total files
- ✅ Zero 404 errors on internal navigation
- ✅ Custom 404 page working
- ✅ All tested pages return HTTP 200

---

## Troubleshooting

### Browser Shows "Connection Refused"

The URL must start with `http://` (not `https://`):
```
✅ http://my-landing-page-1768022354.s3-website-us-east-1.amazonaws.com/cnn-clone/
❌ https://my-landing-page-1768022354.s3-website-us-east-1.amazonaws.com/cnn-clone/
```

### Page Shows XML Error

You're accessing the S3 REST endpoint instead of the website endpoint.

**Wrong**:
```
https://s3.amazonaws.com/my-landing-page-1768022354/cnn-clone/
```

**Right**:
```
http://my-landing-page-1768022354.s3-website-us-east-1.amazonaws.com/cnn-clone/
```

### Images Don't Load

This is **expected**. Images are hosted on CNN's servers (media.cnn.com) and they may:
- Load slowly
- Block requests from S3
- Return 403 errors

This is intentional to avoid copying copyrighted images.

---

## Quick Links

- **Homepage**: http://my-landing-page-1768022354.s3-website-us-east-1.amazonaws.com/cnn-clone/
- **Business**: http://my-landing-page-1768022354.s3-website-us-east-1.amazonaws.com/cnn-clone/business.html
- **Politics**: http://my-landing-page-1768022354.s3-website-us-east-1.amazonaws.com/cnn-clone/politics.html
- **World**: http://my-landing-page-1768022354.s3-website-us-east-1.amazonaws.com/cnn-clone/world.html
- **404 Test**: http://my-landing-page-1768022354.s3-website-us-east-1.amazonaws.com/cnn-clone/test-404.html
