const express = require("express");
const {
  createSocialLinks,
  getSocialLinks,
  updateSocialLinks,
  deletesocialLinks,
  getSocialItemById,
} = require("../controllers/socialItem.controller");

// const {
//   createSocialLinks,
//   getSocialLinks,
//   updateSocialLinks,
//   deletedsocialLinks,
// } = require("../controllers/socialLinks.controller");

const router = express.Router();
router.post("/socialLinks", createSocialLinks);
router.get("/socialLinks", getSocialLinks);
router.put("/socialLinks/:id", updateSocialLinks);
router.delete("/socialLinks:id", deletesocialLinks);
router.get("/socialLinks/:id", getSocialItemById);

// module.exports = router;
// const express = require("express");

// const {
//   createShopByBudget,

//   deleteShopByBudget,
//   getAllShopByBudget,
// } = require("../controllers/shopByController");

// const router = express.Router();

// router.post("/shopByBudget/new", createShopByBudget);

// router.get("/shopByBudget", getAllShopByBudget);
// router.delete("/shopByBudget/:shopByBudgetId", deleteShopByBudget);
module.exports = router;
