require("dotenv").config()
const express = require("express")
const cors = require("cors")
const dns = require("node:dns")
const bodyParser = require("body-parser")
const app = express()
const mongoose = require("mongoose")

// Basic Configuration
const port = process.env.PORT || 3000

app.use(cors())
app.use(bodyParser.json())
app.use(bodyParser.urlencoded({ extended: true }))
app.use("/public", express.static(`${process.cwd()}/public`))

app.get("/", function (req, res) {
  res.sendFile(process.cwd() + "/views/index.html")
})

// Your first API endpoint
app.get("/api/hello", function (req, res) {
  res.json({ greeting: "hello API" })
})

const UrlCollectionSchema = new mongoose.Schema({
  original_url: {
    type: String,
    required: true,
  },
  short_url: {
    type: Number,
    required: true,
  },
})

const UrlCollection = mongoose.model("UrlCollection", UrlCollectionSchema)

app.post("/api/shorturl", function (req, res) {
  const validURLRegex = /https?:\/\/[a-z0-9][a-z0-9]*/

  if (!validURLRegex.test(req.body.url)) {
    return res.json({
      error: "Invalid URL",
    })
  }

  const hostname = new URL(req.body.url).hostname

  return dns.lookup(hostname, async (err, address, family) => {
    if (err) {
      return res.json({
        error: "Invalid Hostname",
      })
    }

    const existingUrl = await UrlCollection.find({
      original_url: req.body.url,
    }).select(["-__v", "-_id"])

    if (existingUrl.length) {
      return res.json(existingUrl)
    } else {
      const largestShortUrl = await UrlCollection.findOne({}).sort({
        short_url: -1,
      })

      const new_short_url = largestShortUrl
        ? Number(largestShortUrl.short_url) + 1
        : 1

      const newUrl = await UrlCollection.create({
        original_url: req.body.url,
        short_url: new_short_url,
      })

      const newlyCreatedDoc = await UrlCollection.findOne({
        _id: newUrl._id,
      }).select(["-_id", "-__v"])

      return res.json(newlyCreatedDoc)
    }
  })
})

app.get("/api/shorturl/:short_url", async (req, res) => {
  console.log(req.params.short_url)

  const docsFound = await UrlCollection.findOne({
    short_url: Number(req.params.short_url),
  })

  if (!docsFound) {
    return res.json({
      error: "short_url not registered",
    })
  }

  return res.redirect(docsFound.original_url)
})

mongoose.connect(process.env.mongodb_url).then(() => {
  console.log("mongodb connected")
  app.listen(port, () => {
    console.log(`server ready at port ${port}`)
  })
})
