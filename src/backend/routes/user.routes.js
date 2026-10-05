const { Router } = require("express");

const { isLoggedIn, isAuthenticated, isSubscriptionActive } = require("../middlewares/auth.middleware");
const { getAllUsers, addUser, deleteUser, updateUser, updateUserPassword, getAllScopes, uploadProfilePhoto, removeProfilePhoto } = require("../controllers/user.controller");

const router = Router();

router.get("/", isLoggedIn, isAuthenticated, isSubscriptionActive, getAllUsers);
router.get("/scopes", isLoggedIn, isAuthenticated, isSubscriptionActive, getAllScopes);
router.post("/add", isLoggedIn, isAuthenticated, isSubscriptionActive, addUser);
router.delete("/delete/:id", isLoggedIn, isAuthenticated, isSubscriptionActive, deleteUser);
router.post("/update/:id", isLoggedIn, isAuthenticated, isSubscriptionActive, updateUser);
router.post("/update-password/:id", isLoggedIn, isAuthenticated, isSubscriptionActive, updateUserPassword);
router.post("/profile-photo", isLoggedIn, isAuthenticated, isSubscriptionActive, uploadProfilePhoto);
router.post("/remove-profile-photo", isLoggedIn, isAuthenticated, isSubscriptionActive, removeProfilePhoto);

module.exports = router;