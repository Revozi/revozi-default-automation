// Admin Dashboard JavaScript - Fully Dynamic Version with Real API Integration

let currentSection = "dashboard"
let refreshInterval
const charts = {}

// Initialize the dashboard
document.addEventListener("DOMContentLoaded", () => {
  initializeNavigation()
  initializeRouter()
  loadSection("dashboard")
  startAutoRefresh()
})

// Router and Navigation System
function initializeRouter() {
  // Handle browser back/forward buttons
  window.addEventListener("popstate", (e) => {
    if (e.state && e.state.section) {
      loadSection(e.state.section, false)
    }
  })
}

function initializeNavigation() {
  const menuItems = document.querySelectorAll(".menu-item")

  menuItems.forEach((item) => {
    item.addEventListener("click", function (e) {
      e.preventDefault()
      const section = this.getAttribute("data-section")
      loadSection(section, true)
    })
  })
}

function loadSection(section, pushState = true) {
  // Update URL and browser history
  if (pushState) {
    history.pushState({ section }, "", `#${section}`)
  }

  // Update active menu item
  document.querySelectorAll(".menu-item").forEach((item) => {
    item.classList.remove("active")
  })
  document.querySelector(`[data-section="${section}"]`)?.classList.add("active")

  // Update page title
  const titles = {
    dashboard: "Dashboard",
    posts: "Post Queue Management",
    "media-generator": "Media Generator",
    notifications: "Notification Center",
    rewards: "Reward System",
    engagement: "Engagement Tracker",
    users: "User Management",
    bots: "Bot Management",
    blogs: "Blog Management",
    settings: "System Settings",
  }
  document.getElementById("page-title").textContent = titles[section] || "Dashboard"

  currentSection = section

  // Hide all sections and show the target section
  document.querySelectorAll(".content-section").forEach((sec) => {
    sec.classList.remove("active")
  })

  const targetSection = document.getElementById(section)
  if (targetSection) {
    targetSection.classList.add("active")
  }

  // Load section-specific data
  loadSectionData(section)
}

// Dynamic Section Loading
async function loadSectionData(section) {
  showLoading()

  try {
    switch (section) {
      case "dashboard":
        await loadDashboardView()
        break
      case "posts":
        await loadPostsView()
        break
      case "media-generator":
        await loadMediaGeneratorView()
        break
      case "notifications":
        await loadNotificationsView()
        break
      case "rewards":
        await loadRewardsView()
        break
      case "engagement":
        await loadEngagementView()
        break
      case "users":
        await loadUsersView()
        break
      case "bots":
        await loadBotsView()
        break
      case "blogs":
        await loadBlogsView()
        break
      case "settings":
        await loadSettingsView()
        break
      default:
        await loadDashboardView()
    }
  } catch (error) {
    showToast(`Failed to load ${section}`, "error")
    console.error(`Error loading ${section}:`, error)
  } finally {
    hideLoading()
  }
}

// Dashboard View
async function loadDashboardView() {
  try {
    // Load dashboard stats
    const stats = await fetchAPI("/admin/stats")
    updateDashboardStats(stats)

    // Load system status
    const status = await fetchAPI("/admin/status")
    updateSystemStatus(status)

    // Load recent activity
    const activity = await fetchAPI("/admin/activity")
    updateRecentActivity(activity)

    // Load engagement and reward stats for charts
    const engagementStats = await fetchAPI("/admin/engagement-stats")
    const rewardStats = await fetchAPI("/admin/reward-stats")

    // Update charts with real data
    await updateDashboardCharts(engagementStats, rewardStats)
  } catch (error) {
    console.error("Dashboard load error:", error)
    showToast("Failed to load dashboard data", "error")
  }
}

function updateDashboardStats(stats) {
  document.getElementById("total-posts").textContent = stats.totalPosts || 0
  document.getElementById("pending-posts").textContent = `${stats.pendingPosts || 0} pending`
  document.getElementById("total-users").textContent = stats.totalUsers || 0
  document.getElementById("new-users").textContent = `${stats.newUsers || 0} new today`
  document.getElementById("total-engagement").textContent = stats.totalEngagement || 0
  document.getElementById("engagement-growth").textContent = `+${stats.engagementGrowth || 0}% today`
  document.getElementById("rewards-issued").textContent = stats.rewardsIssued || 0
  document.getElementById("pending-rewards").textContent = `${stats.pendingRewards || 0} pending`
}

function updateSystemStatus(status) {
  document.getElementById("supabase-status").textContent = status.supabase ? "🟢" : "🔴"

  const updateStatusBadge = (id, isActive) => {
    const element = document.getElementById(id)
    if (element) {
      element.textContent = isActive ? "Active" : "Inactive"
      element.className = `status-badge ${isActive ? "connected" : "disconnected"}`
    }
  }

  updateStatusBadge("queue-status", status.queueProcessing)
  updateStatusBadge("media-status", status.mediaGeneration)
  updateStatusBadge("notification-status", status.notifications)
}

function updateRecentActivity(activities) {
  const container = document.getElementById("recent-activity")
  container.innerHTML = ""

  if (!activities || activities.length === 0) {
    container.innerHTML =
      '<div class="activity-item"><i class="fas fa-info-circle"></i><span>No recent activity</span></div>'
    return
  }

  activities.forEach((activity) => {
    const item = document.createElement("div")
    item.className = "activity-item"
    item.innerHTML = `
      <i class="fas fa-${activity.icon || "robot"}"></i>
      <span>${activity.message}</span>
      <small>${formatTime(activity.timestamp)}</small>
    `
    container.appendChild(item)
  })
}

async function updateDashboardCharts(engagementStats, rewardStats) {
  try {
    // Load bot status for overview
    const botsData = await fetchAPI("/admin/bots/status")
    updateBotStatusOverview(botsData)
  } catch (error) {
    console.error("Chart update error:", error)
  }
}

function updateBotStatusOverview(botStatus) {
  const container = document.getElementById("bot-status-overview")
  const bots = ["instagram", "twitter", "tiktok", "facebook", "reddit", "telegram", "pinterest", "gmb", "snapchat", "linkedin", "quora", "discord"]

  container.innerHTML = ""

  bots.forEach((bot) => {
    const status = botStatus[bot] || { status: "idle" }
    const item = document.createElement("div")
    item.className = "bot-status-item"
    item.innerHTML = `
      <i class="fab fa-${bot === "gmb" ? "google" : bot}"></i>
      <div>${bot.charAt(0).toUpperCase() + bot.slice(1)}</div>
      <span class="status-indicator">${getStatusEmoji(status.status)}</span>
    `
    container.appendChild(item)
  })
}

// Posts View
async function loadPostsView() {
  try {
    const posts = await fetchAPI("/admin/queue")
    renderPostsTable(posts)
    attachPostsEventListeners()
  } catch (error) {
    console.error("Failed to load posts:", error)
    showToast("Failed to load posts", "error")
  }
}

function renderPostsTable(posts) {
  const tbody = document.getElementById("posts-table-body")
  tbody.innerHTML = ""

  if (!posts || posts.length === 0) {
    tbody.innerHTML = '<tr><td colspan="7" class="text-center">No posts found</td></tr>'
    return
  }

  posts.forEach((post, idx) => {
    const caption = post.caption || post.content || ""
    const isLong = caption.length > 50
    const shortId = `caption-short-${idx}`
    const fullId = `caption-full-${idx}`

    const row = document.createElement("tr")
    row.innerHTML = `
      <td>${post.id}</td>
      <td><i class="fab fa-${post.platform}"></i> ${post.platform}</td>
      <td>
        <span id="${shortId}" class="caption-short" style="display:inline;">
          ${truncateText(caption, 50)}
          ${isLong ? `<a href="#" class="read-more" data-idx="${idx}" style="color:blue; text-decoration:underline; margin-left:5px;">Read more</a>` : ""}
        </span>
        <span id="${fullId}" class="caption-full" style="display:none;">
          ${caption}
          ${isLong ? `<a href="#" class="read-less" data-idx="${idx}" style="color:blue; text-decoration:underline; margin-left:5px;">Show less</a>` : ""}
        </span>
      </td>
      <td>${post.media_url ? '<i class="fas fa-image"></i>' : '<i class="fas fa-file-text"></i>'}</td>
      <td><span class="status-badge ${post.status}">${post.status}</span></td>
      <td>${formatTime(post.scheduled_at || post.created_at)}</td>
      <td class="actions">
        ${post.status === "failed" ? `<button class="btn btn-sm btn-warning retry-post" data-id="${post.id}"><i class="fas fa-redo"></i></button>` : ""}
        <button class="btn btn-sm btn-info view-post" data-id="${post.id}"><i class="fas fa-eye"></i></button>
        <button class="btn btn-sm btn-danger delete-post" data-id="${post.id}"><i class="fas fa-trash"></i></button>
      </td>
    `
    tbody.appendChild(row)
  })

  // Event delegation for caption toggling
  tbody.addEventListener("click", function(e) {
    if (e.target.classList.contains("read-more")) {
      e.preventDefault()
      const idx = e.target.getAttribute("data-idx")
      document.getElementById(`caption-short-${idx}`).style.display = "none"
      document.getElementById(`caption-full-${idx}`).style.display = "inline"
    }
    if (e.target.classList.contains("read-less")) {
      e.preventDefault()
      const idx = e.target.getAttribute("data-idx")
      document.getElementById(`caption-full-${idx}`).style.display = "none"
      document.getElementById(`caption-short-${idx}`).style.display = "inline"
    }
  })
}

// Helper to truncate text
function truncateText(text, maxLength) {
  if (!text) return ""
  return text.length > maxLength ? text.substring(0, maxLength) + "..." : text
}

function attachPostsEventListeners() {
  // Retry post buttons
  document.querySelectorAll(".retry-post").forEach((btn) => {
    btn.addEventListener("click", async (e) => {
      const postId = e.target.closest("button").dataset.id
      await retryPost(postId)
    })
  })

  // View post buttons
  document.querySelectorAll(".view-post").forEach((btn) => {
    btn.addEventListener("click", async (e) => {
      const postId = e.target.closest("button").dataset.id
      await viewPostDetails(postId)
    })
  })

  // Delete post buttons
  document.querySelectorAll(".delete-post").forEach((btn) => {
    btn.addEventListener("click", async (e) => {
      const postId = e.target.closest("button").dataset.id
      await deletePost(postId)
    })
  })

  // Filter handlers
  document.getElementById("platform-filter").addEventListener("change", filterPosts)
  document.getElementById("status-filter").addEventListener("change", filterPosts)
}

async function retryPost(postId) {
  try {
    showLoading()
    await fetchAPI(`/admin/posts/${postId}/retry`, "POST")
    showToast("Post retry initiated")
    await loadPostsView() // Reload the view
  } catch (error) {
    showToast("Failed to retry post", "error")
  } finally {
    hideLoading()
  }
}

async function deletePost(postId) {
  if (!confirm("Are you sure you want to delete this post?")) return

  try {
    showLoading()
    await fetchAPI(`/admin/posts/${postId}`, "DELETE")
    showToast("Post deleted successfully")
    await loadPostsView() // Reload the view
  } catch (error) {
    showToast("Failed to delete post", "error")
  } finally {
    hideLoading()
  }
}

async function viewPostDetails(postId) {
  try {
    const posts = await fetchAPI("/admin/queue")
    const post = posts.find((p) => p.id == postId)
    if (post) {
      openModal("Post Details", renderPostDetailsModal(post))
    } else {
      showToast("Post not found", "error")
    }
  } catch (error) {
    showToast("Failed to load post details", "error")
  }
}

function renderPostDetailsModal(post) {
  return `
    <div class="post-details">
      <div class="form-row">
        <strong>Platform:</strong> ${post.platform}
      </div>
      <div class="form-row">
        <strong>Status:</strong> <span class="status-badge ${post.status}">${post.status}</span>
      </div>
      <div class="form-row">
        <strong>Caption:</strong>
        <div class="caption-preview">${post.caption || post.content}</div>
      </div>
      ${post.media_url ? `<div class="form-row"><strong>Media:</strong><br><img src="${post.media_url}" style="max-width: 100%; height: auto;"></div>` : ""}
      <div class="form-row">
        <strong>Scheduled:</strong> ${formatTime(post.scheduled_at)}
      </div>
      <div class="form-row">
        <strong>Created:</strong> ${formatTime(post.created_at)}
      </div>
    </div>
  `
}

async function filterPosts() {
  const platformFilter = document.getElementById("platform-filter").value
  const statusFilter = document.getElementById("status-filter").value

  const params = new URLSearchParams()
  if (platformFilter !== "all") params.append("platform", platformFilter)
  if (statusFilter !== "all") params.append("status", statusFilter)

  try {
    const posts = await fetchAPI(`/admin/queue?${params.toString()}`)
    renderPostsTable(posts)
    attachPostsEventListeners()
  } catch (error) {
    showToast("Failed to filter posts", "error")
  }
}

async function retryAllFailed() {
  if (!confirm("Are you sure you want to retry all failed posts?")) return

  try {
    showLoading()
    const result = await fetchAPI("/admin/posts/retry-failed", "POST")
    showToast(`Retrying failed posts`)
    await loadPostsView()
  } catch (error) {
    showToast("Failed to retry posts", "error")
  } finally {
    hideLoading()
  }
}

// Media Generator View
async function loadMediaGeneratorView() {
  // Initialize media generator interface
  attachMediaGeneratorListeners()
}

function attachMediaGeneratorListeners() {
  // Image generation
  const generateImageBtn = document.querySelector("#media-generator .btn-primary")
  if (generateImageBtn) {
    generateImageBtn.replaceWith(generateImageBtn.cloneNode(true)) // Remove old listeners
    document.querySelector("#media-generator .btn-primary").addEventListener("click", generateImage)
  }

  // Video generation
  const generateVideoBtn = document.querySelector("#media-generator .generator-card:nth-child(2) .btn-primary")
  if (generateVideoBtn) {
    generateVideoBtn.replaceWith(generateVideoBtn.cloneNode(true))
    document
      .querySelector("#media-generator .generator-card:nth-child(2) .btn-primary")
      .addEventListener("click", generateVideo)
  }

  // Caption generation
  const generateCaptionBtn = document.querySelector(".caption-generator .btn-success")
  if (generateCaptionBtn) {
    generateCaptionBtn.replaceWith(generateCaptionBtn.cloneNode(true))
    document.querySelector(".caption-generator .btn-success").addEventListener("click", generateCaption)
  }

  // Schedule post
  const scheduleBtn = document.querySelector(".schedule-post .btn-primary")
  if (scheduleBtn) {
    scheduleBtn.replaceWith(scheduleBtn.cloneNode(true))
    document.querySelector(".schedule-post .btn-primary").addEventListener("click", schedulePost)
  }
}

async function generateImage() {
  const prompt = document.getElementById("image-prompt").value
  const style = document.getElementById("image-style").value

  if (!prompt.trim()) {
    showToast("Please enter an image prompt", "warning")
    return
  }

  try {
    showLoading()
    const preview = document.getElementById("image-preview")
    preview.innerHTML =
      '<div class="preview-placeholder"><i class="fas fa-spinner fa-spin"></i><p>Generating image...</p></div>'

    // Use the AI service endpoint for image generation
    const result = await fetchAPI("/admin/preview-caption", "POST", {
      prompt,
      style,
      type: "image",
    })

    if (result.image_url) {
      preview.innerHTML = `<img src="${result.image_url}" style="max-width: 100%; height: auto; border-radius: 8px;">`
      showToast("Image generated successfully")
    } else {
      throw new Error("No image URL returned")
    }
  } catch (error) {
    document.getElementById("image-preview").innerHTML =
      '<div class="preview-placeholder"><i class="fas fa-exclamation-triangle"></i><p>Failed to generate image</p></div>'
    showToast("Failed to generate image", "error")
  } finally {
    hideLoading()
  }
}

async function generateVideo() {
  const prompt = document.getElementById("video-prompt").value
  const duration = document.getElementById("video-duration").value

  if (!prompt.trim()) {
    showToast("Please enter a video prompt", "warning")
    return
  }

  try {
    showLoading()
    const preview = document.getElementById("video-preview")
    preview.innerHTML =
      '<div class="preview-placeholder"><i class="fas fa-spinner fa-spin"></i><p>Generating video...</p></div>'

    const result = await fetchAPI("/admin/preview-caption", "POST", {
      prompt,
      duration,
      type: "video",
    })

    if (result.video_url) {
      preview.innerHTML = `<video controls style="max-width: 100%; height: auto; border-radius: 8px;"><source src="${result.video_url}" type="video/mp4"></video>`
      showToast("Video generated successfully")
    } else {
      throw new Error("No video URL returned")
    }
  } catch (error) {
    document.getElementById("video-preview").innerHTML =
      '<div class="preview-placeholder"><i class="fas fa-exclamation-triangle"></i><p>Failed to generate video</p></div>'
    showToast("Failed to generate video", "error")
  } finally {
    hideLoading()
  }
}

async function generateCaption() {
  const topic = document.getElementById("caption-topic").value
  const tone = document.getElementById("caption-tone").value

  if (!topic.trim()) {
    showToast("Please enter a topic for the caption", "warning")
    return
  }

  try {
    showLoading()
    const result = await fetchAPI(
      "/admin/caption/generate",
      "GET",
      null,
      `?topic=${encodeURIComponent(topic)}&tone=${tone}`,
    )
    document.getElementById("generated-caption").innerHTML = `<p>${result.caption || result.text}</p>`
    showToast("Caption generated successfully")
  } catch (error) {
    showToast("Failed to generate caption", "error")
  } finally {
    hideLoading()
  }
}

async function schedulePost() {
  const platforms = Array.from(document.getElementById("schedule-platform").selectedOptions).map(
    (option) => option.value,
  )
  const scheduledTime = document.getElementById("schedule-time").value
  const captionElement = document.getElementById("generated-caption")
  const caption = captionElement.textContent || captionElement.innerText

  if (platforms.length === 0) {
    showToast("Please select at least one platform", "warning")
    return
  }

  if (!scheduledTime) {
    showToast("Please select a schedule time", "warning")
    return
  }

  if (!caption || caption === "Generated caption will appear here...") {
    showToast("Please generate a caption first", "warning")
    return
  }

  try {
    showLoading()
    await fetchAPI("/admin/posts/schedule", "POST", {
      platforms,
      scheduled_at: scheduledTime,
      caption,
      content: caption,
      media_url: null,
    })

    showToast("Post scheduled successfully")

    // Clear form
    document.getElementById("schedule-platform").selectedIndex = -1
    document.getElementById("schedule-time").value = ""
    document.getElementById("generated-caption").innerHTML = "<p>Generated caption will appear here...</p>"
  } catch (error) {
    showToast("Failed to schedule post", "error")
  } finally {
    hideLoading()
  }
}

// Notifications View
async function loadNotificationsView() {
  try {
    const notifications = await fetchAPI("/admin/notifications/all")
    renderNotificationsList(notifications)
    attachNotificationsEventListeners()
  } catch (error) {
    console.error("Failed to load notifications:", error)
    showToast("Failed to load notifications", "error")
  }
}

function renderNotificationsList(notifications) {
  const container = document.getElementById("notifications-list")
  container.innerHTML = ""

  if (!notifications || notifications.length === 0) {
    container.innerHTML =
      '<div class="notification-item"><div class="notification-content"><p>No notifications found</p></div></div>'
    return
  }

  notifications.forEach((notification) => {
    const item = document.createElement("div")
    item.className = `notification-item ${notification.read ? "" : "unread"}`

    const iconColor =
      {
        reward: "#4caf50",
        system: "#2196f3",
        warning: "#ff9800",
        error: "#f44336",
      }[notification.type] || "#6c757d"

    item.innerHTML = `
      <div class="notification-icon" style="background: ${iconColor}">
        <i class="fas fa-${getNotificationIcon(notification.type)}"></i>
      </div>
      <div class="notification-content">
        <h4>${notification.title}</h4>
        <p>${notification.message}</p>
        <small>${formatTime(notification.created_at)}</small>
      </div>
      <div class="notification-actions">
        ${!notification.read ? `<button class="btn btn-sm btn-secondary mark-read" data-id="${notification.id}"><i class="fas fa-check"></i></button>` : ""}
        <button class="btn btn-sm btn-danger delete-notification" data-id="${notification.id}"><i class="fas fa-trash"></i></button>
      </div>
    `
    container.appendChild(item)
  })
}

function attachNotificationsEventListeners() {
  // Mark as read buttons
  document.querySelectorAll(".mark-read").forEach((btn) => {
    btn.addEventListener("click", async (e) => {
      const notificationId = e.target.closest("button").dataset.id
      await markAsRead(notificationId)
    })
  })

  // Delete notification buttons
  document.querySelectorAll(".delete-notification").forEach((btn) => {
    btn.addEventListener("click", async (e) => {
      const notificationId = e.target.closest("button").dataset.id
      await deleteNotification(notificationId)
    })
  })

  // Filter buttons
  document.querySelectorAll(".filter-btn").forEach((btn) => {
    btn.addEventListener("click", function () {
      document.querySelectorAll(".filter-btn").forEach((b) => b.classList.remove("active"))
      this.classList.add("active")
      filterNotifications(this.dataset.filter)
    })
  })
}

function getNotificationIcon(type) {
  const icons = {
    reward: "gift",
    system: "cog",
    warning: "exclamation-triangle",
    error: "times-circle",
  }
  return icons[type] || "bell"
}

async function filterNotifications(filter) {
  try {
    const params = filter !== "all" ? `?type=${filter}` : ""
    const notifications = await fetchAPI(`/admin/notifications/all${params}`)
    renderNotificationsList(notifications)
    attachNotificationsEventListeners()
  } catch (error) {
    showToast("Failed to filter notifications", "error")
  }
}

async function markAsRead(notificationId) {
  try {
    await fetchAPI(`/admin/notifications/${notificationId}/read`, "PATCH")
    await loadNotificationsView()
  } catch (error) {
    showToast("Failed to mark notification as read", "error")
  }
}

async function deleteNotification(notificationId) {
  try {
    await fetchAPI(`/admin/notifications/${notificationId}`, "DELETE")
    await loadNotificationsView()
  } catch (error) {
    showToast("Failed to delete notification", "error")
  }
}

async function markAllAsRead() {
  try {
    showLoading()
    // Since we don't have a specific endpoint for mark all as read, we'll need to implement this differently
    // For now, we'll show a message that this feature needs backend implementation
    showToast("Mark all as read feature needs backend implementation")
    await loadNotificationsView()
  } catch (error) {
    showToast("Failed to mark notifications as read", "error")
  } finally {
    hideLoading()
  }
}

function openCreateNotificationModal() {
  openModal(
    "Create Notification",
    `
    <div class="form-row">
      <input type="text" id="notification-title" placeholder="Notification title">
    </div>
    <div class="form-row">
      <textarea id="notification-message" placeholder="Notification message" rows="4"></textarea>
    </div>
    <div class="form-row">
      <select id="notification-type">
        <option value="system">System</option>
        <option value="reward">Reward</option>
        <option value="warning">Warning</option>
        <option value="error">Error</option>
      </select>
    </div>
    <div class="form-row">
      <button class="btn btn-primary" onclick="createNotification()">Create Notification</button>
    </div>
  `,
  )
}

async function createNotification() {
  const title = document.getElementById("notification-title").value
  const message = document.getElementById("notification-message").value
  const type = document.getElementById("notification-type").value

  if (!title.trim() || !message.trim()) {
    showToast("Please fill in all fields", "warning")
    return
  }

  try {
    showLoading()
    await fetchAPI("/admin/notifications", "POST", { title, message, type })
    showToast("Notification created successfully")
    closeModal()
    await loadNotificationsView()
  } catch (error) {
    showToast("Failed to create notification", "error")
  } finally {
    hideLoading()
  }
}

// Rewards View
async function loadRewardsView() {
  try {
    const { rewards } = await fetchAPI("/admin/rewards/all")  // ✅ Get full rewards list

    if (!Array.isArray(rewards)) throw new Error("Invalid rewards data")

    // 🎯 Count reward types
    const counts = {
      silver: 0,
      gold: 0,
      viral: 0,
    }

    rewards.forEach((r) => {
      const type = (r.reward_type || "").toLowerCase()
      if (counts[type] !== undefined) {
        counts[type] += 1
      }
    })

    updateRewardStats(counts)
    renderRewardsTable(rewards)
    attachRewardsEventListeners()

  } catch (error) {
    console.error("[REWARDS] Load failed:", error)
    showToast("Failed to load rewards", "error")
  }
}


function updateRewardStats(counts) {
  document.getElementById("silver-rewards").textContent = counts.silver || 0
  document.getElementById("gold-rewards").textContent = counts.gold || 0
  document.getElementById("viral-rewards").textContent = counts.viral || 0
}

function renderRewardsTable(rewards) {
  const tbody = document.getElementById("rewards-table-body")
  tbody.innerHTML = ""

  if (!rewards || rewards.length === 0) {
    tbody.innerHTML = '<tr><td colspan="7" class="text-center">No rewards found</td></tr>'
    return
  }

  rewards.forEach((reward) => {
    const row = document.createElement("tr")
    row.innerHTML = `
      <td>${reward.user_email || reward.user_id}</td>
      <td><span class="status-badge ${reward.reward_type}">${capitalize(reward.reward_type)}</span></td>
      <td>$${reward.amount}</td>
      <td>${reward.metadata?.source || 'N/A'}</td>
      <td><span class="status-badge ${reward.notified ? 'notified' : 'pending'}">${reward.notified ? 'Notified' : 'Pending'}</span></td>
      <td>${formatTime(reward.issued_at)}</td>
      <td class="actions">
        ${!reward.notified ? `<button class="btn btn-sm btn-success approve-reward" data-id="${reward.id}"><i class="fas fa-check"></i></button>` : ""}
        <button class="btn btn-sm btn-info view-reward" data-id="${reward.id}"><i class="fas fa-eye"></i></button>
      </td>
    `
    tbody.appendChild(row)
  })
}


  rewards.forEach((reward) => {
    const row = document.createElement("tr")
    row.innerHTML = `
      <td>${reward.user_email || reward.user_id}</td>
      <td><span class="status-badge ${reward.tier}">${reward.tier}</span></td>
      <td>$${reward.amount}</td>
      <td>${reward.reason}</td>
      <td><span class="status-badge ${reward.status}">${reward.status}</span></td>
      <td>${formatTime(reward.created_at)}</td>
      <td class="actions">
        ${reward.status === "pending" ? `<button class="btn btn-sm btn-success approve-reward" data-id="${reward.id}"><i class="fas fa-check"></i></button>` : ""}
        <button class="btn btn-sm btn-info view-reward" data-id="${reward.id}"><i class="fas fa-eye"></i></button>
      </td>
    `
    tbody.appendChild(row)
  })

function capitalize(str) {
  return str ? str.charAt(0).toUpperCase() + str.slice(1).toLowerCase() : ''
}

function formatTime(dateStr) {
  const date = new Date(dateStr)
  return date.toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })
}

function attachRewardsEventListeners() {
  // Approve reward buttons
  document.querySelectorAll(".approve-reward").forEach((btn) => {
    btn.addEventListener("click", async (e) => {
      const rewardId = e.target.closest("button").dataset.id
      await approveReward(rewardId)
    })
  })

  // View reward buttons
  document.querySelectorAll(".view-reward").forEach((btn) => {
    btn.addEventListener("click", async (e) => {
      const rewardId = e.target.closest("button").dataset.id
      await viewRewardDetails(rewardId)
    })
  })

  // Filter handler
  document.getElementById("reward-tier-filter").addEventListener("change", filterRewards)
}

async function filterRewards() {
  // Placeholder for reward filtering
  showToast("Reward filtering needs backend implementation")
}

async function approveReward(rewardId) {
  showToast("Reward approval needs backend implementation")
}

async function viewRewardDetails(rewardId) {
  showToast("Reward details view needs backend implementation")
}

function openIssueRewardModal() {
  openModal(
    "Issue Reward",
    `
    <div class="form-row">
      <input type="email" id="reward-user-email" placeholder="User email">
    </div>
    <div class="form-row">
      <select id="reward-tier">
        <option value="silver">Silver</option>
        <option value="gold">Gold</option>
        <option value="viral">Viral</option>
      </select>
    </div>
    <div class="form-row">
      <input type="number" id="reward-amount" placeholder="Amount ($)" min="0" step="0.01">
    </div>
    <div class="form-row">
      <textarea id="reward-reason" placeholder="Reason for reward" rows="3"></textarea>
    </div>
    <div class="form-row">
      <button class="btn btn-primary" onclick="issueReward()">Issue Reward</button>
    </div>
  `,
  )
}

async function issueReward() {
  showToast("Issue reward needs backend implementation")
  closeModal()
}

// Engagement View
async function loadEngagementView() {
  try {
    const engagementData = await fetchAPI("/admin/engagement")
    const topUsers = await fetchAPI("/admin/top-users")

    renderEngagementTable(engagementData)
    updateTopPerformers(topUsers)
    attachEngagementEventListeners()
  } catch (error) {
    console.error("Failed to load engagement:", error)
    showToast("Failed to load engagement data", "error")
  }
}

function renderEngagementTable(engagementData) {
  const tbody = document.getElementById("engagement-table-body")
  tbody.innerHTML = ""

  if (!engagementData || engagementData.length === 0) {
    tbody.innerHTML = '<tr><td colspan="8" class="text-center">No engagement data found</td></tr>'
    return
  }

  engagementData.forEach((item) => {
    const row = document.createElement("tr")
    row.innerHTML = `
      <td>${truncateText(item.post_caption || item.content, 30)}</td>
      <td><i class="fab fa-${item.platform}"></i> ${item.platform}</td>
      <td>${item.user_email || item.user_id}</td>
      <td>${item.likes || 0}</td>
      <td>${item.shares || 0}</td>
      <td>${item.views || 0}</td>
      <td>
        <div class="progress-bar" style="background: #e0e0e0; height: 10px; border-radius: 5px;">
          <div class="progress" style="width: ${Math.min(item.score || 0, 100)}%; background: #4caf50; height: 100%; border-radius: 5px;"></div>
        </div>
      </td>
      <td>${item.reward_triggered ? '<i class="fas fa-gift" style="color: #4caf50;"></i>' : "-"}</td>
    `
    tbody.appendChild(row)
  })
}

function updateTopPerformers(performers) {
  const container = document.getElementById("top-performers-list")
  container.innerHTML = ""

  if (!performers || performers.length === 0) {
    container.innerHTML = '<div class="performer-item">No top performers yet</div>'
    return
  }

  performers.forEach((performer, index) => {
    const item = document.createElement("div")
    item.className = "performer-item"
    item.innerHTML = `
      <div class="performer-rank">${index + 1}</div>
      <div class="flex-1">
        <div>${performer.user_email || performer.user_id}</div>
        <small>${performer.total_engagement || 0} total engagement</small>
      </div>
    `
    container.appendChild(item)
  })
}

function attachEngagementEventListeners() {
  document.getElementById("engagement-platform-filter").addEventListener("change", filterEngagement)
  document.getElementById("engagement-user-search").addEventListener("keyup", searchEngagement)
}

async function filterEngagement() {
  const platformFilter = document.getElementById("engagement-platform-filter").value
  const params = platformFilter !== "all" ? `?platform=${platformFilter}` : ""

  try {
    const engagementData = await fetchAPI(`/admin/engagement${params}`)
    renderEngagementTable(engagementData)
  } catch (error) {
    showToast("Failed to filter engagement data", "error")
  }
}

async function searchEngagement() {
  const searchTerm = document.getElementById("engagement-user-search").value
  const params = searchTerm ? `?search=${encodeURIComponent(searchTerm)}` : ""

  try {
    const engagementData = await fetchAPI(`/admin/engagement${params}`)
    renderEngagementTable(engagementData)
  } catch (error) {
    showToast("Failed to search engagement data", "error")
  }
}

// Users View
async function loadUsersView() {
  try {
    const users = await fetchAPI("/admin/users")
    renderUsersTable(users)
    attachUsersEventListeners()
  } catch (error) {
    console.error("Failed to load users:", error)
    showToast("Failed to load users", "error")
  }
}

function renderUsersTable(users) {
  const tbody = document.getElementById("users-table-body")
  tbody.innerHTML = ""

  if (!users || users.length === 0) {
    tbody.innerHTML = '<tr><td colspan="8" class="text-center">No users found</td></tr>'
    return
  }

  users.forEach((user) => {
    const row = document.createElement("tr")
    row.innerHTML = `
      <td>${user.id}</td>
      <td>${user.email || ""}</td>
      <td>${user.phone || ""}</td>
      <td>${user.post_count || 0}</td>
      <td>${user.reward_count || 0}</td>
      <td><span class="status-badge ${user.status || "active"}">${user.status || "active"}</span></td>
      <td>${formatTime(user.last_active || user.created_at)}</td>
      <td class="actions">
        <button class="btn btn-sm btn-info view-user" data-id="${user.id}"><i class="fas fa-eye"></i></button>
        <button class="btn btn-sm btn-warning toggle-user-status" data-id="${user.id}" data-status="${user.status}">
          <i class="fas fa-${user.status === "active" ? "pause" : "play"}"></i>
        </button>
        <button class="btn btn-sm btn-danger delete-user" data-id="${user.id}"><i class="fas fa-trash"></i></button>
      </td>
    `
    tbody.appendChild(row)
  })
}

function attachUsersEventListeners() {
  // View user buttons
  document.querySelectorAll(".view-user").forEach((btn) => {
    btn.addEventListener("click", async (e) => {
      const userId = e.target.closest("button").dataset.id
      await viewUserDetails(userId)
    })
  })

  // Toggle user status buttons
  document.querySelectorAll(".toggle-user-status").forEach((btn) => {
    btn.addEventListener("click", async (e) => {
      const button = e.target.closest("button")
      const userId = button.dataset.id
      const currentStatus = button.dataset.status
      await toggleUserStatus(userId, currentStatus)
    })
  })

  // Delete user buttons
  document.querySelectorAll(".delete-user").forEach((btn) => {
    btn.addEventListener("click", async (e) => {
      const userId = e.target.closest("button").dataset.id
      await deleteUser(userId)
    })
  })

  // Filter checkboxes
  document.getElementById("show-active").addEventListener("change", filterUsers)
  document.getElementById("show-inactive").addEventListener("change", filterUsers)
  document.getElementById("show-deleted").addEventListener("change", filterUsers)
}

async function viewUserDetails(userId) {
  try {
    const users = await fetchAPI("/admin/users")
    const user = users.find((u) => u.id == userId)
    if (user) {
      openModal("User Details", renderUserDetailsModal(user))
    } else {
      showToast("User not found", "error")
    }
  } catch (error) {
    showToast("Failed to load user details", "error")
  }
}

function renderUserDetailsModal(user) {
  return `
    <div class="user-details">
      <div class="form-row">
        <strong>ID:</strong> ${user.id}
      </div>
      <div class="form-row">
        <strong>Email:</strong> ${user.email || "N/A"}
      </div>
      <div class="form-row">
        <strong>Phone:</strong> ${user.phone || "N/A"}
      </div>
      <div class="form-row">
        <strong>Status:</strong> <span class="status-badge ${user.status}">${user.status}</span>
      </div>
      <div class="form-row">
        <strong>Posts:</strong> ${user.post_count || 0}
      </div>
      <div class="form-row">
        <strong>Rewards:</strong> ${user.reward_count || 0}
      </div>
      <div class="form-row">
        <strong>Created:</strong> ${formatTime(user.created_at)}
      </div>
      <div class="form-row">
        <strong>Last Active:</strong> ${formatTime(user.last_active)}
      </div>
    </div>
  `
}

async function toggleUserStatus(userId, currentStatus) {
  showToast("User status toggle needs backend implementation")
}

async function deleteUser(userId) {
  if (!confirm("Are you sure you want to delete this user?")) return

  try {
    showLoading()
    await fetchAPI(`/admin/users/${userId}`, "DELETE")
    showToast("User deleted successfully")
    await loadUsersView()
  } catch (error) {
    showToast("Failed to delete user", "error")
  } finally {
    hideLoading()
  }
}

async function filterUsers() {
  // For now, we'll reload all users since we don't have specific filtering endpoints
  await loadUsersView()
}

async function deleteInactiveUsers() {
  if (!confirm("Are you sure you want to delete all inactive users (30+ days)?")) return

  try {
    showLoading()
    await fetchAPI("/auth/delete-inactive", "DELETE")
    showToast("Inactive users deleted")
    await loadUsersView()
  } catch (error) {
    showToast("Failed to delete inactive users", "error")
  } finally {
    hideLoading()
  }
}

// Bots View
async function loadBotsView() {
  try {
    const botsData = await fetchAPI("/admin/bots/status")
    updateBotCards(botsData)
    updateCronTable(botsData) // << this must be here
    attachBotsEventListeners()
  } catch (error) {
    console.error("Failed to load bots:", error)
    showToast("Failed to load bot status", "error")
  }
}


function updateBotCards(botsData) {
  Object.keys(botsData).forEach((bot) => {
    const botInfo = botsData[bot]
    const statusElement = document.getElementById(`${bot}-status`)
    const lastRunElement = document.getElementById(`${bot}-last-run`)
    const successRateElement = document.getElementById(`${bot}-success-rate`)

    if (statusElement) {
      const botStatus = botInfo.status || "idle"
      statusElement.textContent = `${getStatusEmoji(botStatus)} ${capitalize(botStatus)}`
    }

    if (lastRunElement) {
      lastRunElement.textContent = botInfo.lastRun ? formatTime(botInfo.lastRun) : "Never"
    }

    if (successRateElement) {
      // Optional: you could calculate success rate using error logs if available
      successRateElement.textContent = botInfo.lastError ? "⚠️ 0%" : "✅ 100%"
    }
  })
}


function updateCronTable(botsData) {
  const tbody = document.getElementById("cron-table-body")
  tbody.innerHTML = ""

  Object.entries(botsData).forEach(([bot, data]) => {
    const schedule = getBotCronSchedule(bot)

    const row = document.createElement("tr")
    row.innerHTML = `
      <td>${capitalize(bot)} Bot</td>
      <td><code>${schedule}</code></td>
      <td>${data.lastRun ? formatTime(data.lastRun) : "Not yet"}</td>
      <td><span class="status-badge ${getStatusClass(data.status)}">${capitalize(data.status)}</span></td>
      <td class="actions">
        <button class="btn btn-sm btn-warning pause-cron" data-bot="${bot}">
          <i class="fas fa-pause"></i>
        </button>
        <button class="btn btn-sm btn-success resume-cron" data-bot="${bot}">
          <i class="fas fa-play"></i>
        </button>
      </td>
    `
    tbody.appendChild(row)
  })
}
function getStatusClass(status) {
  switch ((status || "").toLowerCase()) {
    case "running":
      return "connected"
    case "completed":
      return "success"
    case "paused":
      return "warning"
    case "idle":
    default:
      return "disconnected"
  }
}

function getBotCronSchedule(bot) {
  const schedules = {
    instagram: "*/15 * * * *",
    twitter: "5,35 * * * *",
    tiktok: "10,40 * * * *",
    facebook: "25,55 * * * *",
    reddit: "30 * * * *",
    telegram: "20 * * * *",
    pinterest: "50 * * * *",
    gmb: "45 * * * *",
    snapchat: "0,30 * * * *",
    linkedin: "15,45 * * * *",
    quora: "10,50 * * * *",
    discord: "5,25 * * * *",
  }
  return schedules[bot] || "*/30 * * * *" // fallback
}

function getStatusEmoji(status) {
  switch ((status || "").toLowerCase()) {
    case "running":
      return "🟢"
    case "completed":
      return "✅"
    case "paused":
      return "⏸️"
    case "idle":
      return "⚪"
    default:
      return "❔"
  }
}

function capitalize(str) {
  return str.charAt(0).toUpperCase() + str.slice(1)
}

function formatTime(isoStr) {
  const date = new Date(isoStr)
  return date.toLocaleString("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  })
}

 

function attachBotsEventListeners() {
  // Run bot buttons
  document.querySelectorAll('[onclick^="runBot"]').forEach((btn) => {
    const botName = btn.getAttribute("onclick").match(/runBot$$'(.+?)'$$/)[1]
    btn.removeAttribute("onclick")
    btn.addEventListener("click", () => runBot(botName))
  })

  // View logs buttons
  document.querySelectorAll('[onclick^="viewBotLogs"]').forEach((btn) => {
    const botName = btn.getAttribute("onclick").match(/viewBotLogs$$'(.+?)'$$/)[1]
    btn.removeAttribute("onclick")
    btn.addEventListener("click", () => viewBotLogs(botName))
  })

  // Configure settings buttons
  document.querySelectorAll('[onclick^="configureBotSettings"]').forEach((btn) => {
    const botName = btn.getAttribute("onclick").match(/configureBotSettings$$'(.+?)'$$/)[1]
    btn.removeAttribute("onclick")
    btn.addEventListener("click", () => configureBotSettings(botName))
  })

  // Cron job controls
  document.querySelectorAll(".pause-cron").forEach((btn) => {
    btn.addEventListener("click", async (e) => {
      const botName = e.target.closest("button").dataset.bot
      await pauseCronJob(botName)
    })
  })

  document.querySelectorAll(".resume-cron").forEach((btn) => {
    btn.addEventListener("click", async (e) => {
      const botName = e.target.closest("button").dataset.bot
      await resumeCronJob(botName)
    })
  })
}

// function getStatusEmoji(status) {
//   const emojis = {
//     idle: "🟢",
//     running: "🟡",
//     error: "🔴",
//     paused: "⏸️",
//   }
//   return emojis[status] || "🟢"
// }

async function runBot(botName) {
  try {
    showLoading()
    document.getElementById(`${botName}-status`).textContent = "🟡 Running"

    await fetchAPI(`/admin/bots/${botName}/run`, "POST")
    showToast(`${botName} bot executed successfully`)

    setTimeout(() => {
      loadBotsView()
    }, 5000)
  } catch (error) {
    showToast(`Failed to run ${botName} bot`, "error")
    document.getElementById(`${botName}-status`).textContent = "🔴 Error"
  } finally {
    hideLoading()
  }
}

async function runAllBots() {
  if (!confirm("Are you sure you want to run all bots?")) return

  const bots = ["instagram", "twitter", "tiktok", "facebook", "reddit", "telegram", "pinterest", "gmb", "snapchat", "linkedin", "quora", "discord"]

  for (const bot of bots) {
    await runBot(bot)
    await new Promise((resolve) => setTimeout(resolve, 2000))
  }
}

async function restartCronJobs() {
  try {
    showLoading()
    await fetchAPI("/admin/cron/restart", "POST")
    showToast("Cron jobs restarted successfully")
    await loadBotsView()
  } catch (error) {
    showToast("Failed to restart cron jobs", "error")
  } finally {
    hideLoading()
  }
}

async function pauseCronJob(botName) {
  try {
    await fetchAPI(`/admin/cron/${botName}/pause`, "POST")
    showToast(`${botName} cron job paused`)
    await loadBotsView()
  } catch (error) {
    showToast(`Failed to pause ${botName} cron job`, "error")
  }
}

async function resumeCronJob(botName) {
  try {
    await fetchAPI(`/admin/bots/${botName}/restart`, "POST")
    showToast(`${botName} cron job resumed`)
    await loadBotsView()
  } catch (error) {
    showToast(`Failed to resume ${botName} cron job`, "error")
  }
}

function viewBotLogs(botName) {
  loadSection("settings")
  setTimeout(() => {
    document.getElementById("log-type-filter").value = botName
    refreshLogs()
  }, 100)
}

function configureBotSettings(botName) {
  openModal(
    `${botName.charAt(0).toUpperCase() + botName.slice(1)} Bot Settings`,
    `
    <div class="form-row">
      <label>Retry Limit:</label>
      <input type="number" id="bot-retry-limit" value="3" min="1" max="10">
    </div>
    <div class="form-row">
      <label>Priority:</label>
      <select id="bot-priority">
        <option value="low">Low</option>
        <option value="normal" selected>Normal</option>
        <option value="high">High</option>
      </select>
    </div>
    <div class="form-row">
      <label class="toggle-switch">
        <input type="checkbox" id="bot-enabled" checked>
        <span class="slider"></span>
        <span class="label">Enabled</span>
      </label>
    </div>
    <div class="form-row">
      <button class="btn btn-primary" onclick="saveBotSettings('${botName}')">Save Settings</button>
    </div>
  `,
  )
}

async function saveBotSettings(botName) {
  showToast("Bot settings save needs backend implementation")
  closeModal()
}

// Blogs View
async function loadBlogsView() {
  try {
    const blogs = await fetchAPI("/admin/blog")
    renderBlogsTable(blogs)
    attachBlogsEventListeners()
  } catch (error) {
    console.error("Failed to load blogs:", error)
    showToast("Failed to load blogs", "error")
  }
}

function renderBlogsTable(blogs) {
  const tbody = document.getElementById("blogs-table-body")
  tbody.innerHTML = ""

  if (!blogs || blogs.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" class="text-center">No blogs found</td></tr>'
    return
  }

  blogs.forEach((blog) => {
    const row = document.createElement("tr")
    row.innerHTML = `
      <td>${truncateText(blog.title, 40)}</td>
      <td>${formatTime(blog.created_at)}</td>
      <td>${getPublishStatus(blog.medium_published)}</td>
      <td>${getPublishStatus(blog.substack_published)}</td>
      <td>${getPublishStatus(blog.reddit_published)}</td>
      <td class="actions">
        <button class="btn btn-sm btn-info view-blog" data-id="${blog.id}"><i class="fas fa-eye"></i></button>
        <button class="btn btn-sm btn-primary publish-blog" data-id="${blog.id}" data-platform="medium"><i class="fab fa-medium"></i></button>
        <button class="btn btn-sm btn-warning publish-blog" data-id="${blog.id}" data-platform="substack"><i class="fas fa-newspaper"></i></button>
        <button class="btn btn-sm btn-danger publish-blog" data-id="${blog.id}" data-platform="reddit"><i class="fab fa-reddit"></i></button>
      </td>
    `
    tbody.appendChild(row)
  })
}

function attachBlogsEventListeners() {
  // View blog buttons
  document.querySelectorAll(".view-blog").forEach((btn) => {
    btn.addEventListener("click", async (e) => {
      const blogId = e.target.closest("button").dataset.id
      await viewBlog(blogId)
    })
  })

  // Publish blog buttons
  document.querySelectorAll(".publish-blog").forEach((btn) => {
    btn.addEventListener("click", async (e) => {
      const button = e.target.closest("button")
      const blogId = button.dataset.id
      const platform = button.dataset.platform
      await publishBlog(blogId, platform)
    })
  })
}

function getPublishStatus(published) {
  return published ? "🟢" : "🔴"
}

async function generateBlog() {
  const prompt = document.getElementById("blog-prompt").value
  const length = document.getElementById("blog-length").value
  const tone = document.getElementById("blog-tone").value

  if (!prompt.trim()) {
    showToast("Please enter a blog prompt", "warning")
    return
  }

  try {
    showLoading()
    const preview = document.getElementById("blog-preview")
    preview.innerHTML =
      '<div class="preview-placeholder"><i class="fas fa-spinner fa-spin"></i><p>Generating blog...</p></div>'

    const result = await fetchAPI("/admin/blog", "POST", {
      prompt,
      length,
      tone,
      title: `Generated Blog - ${new Date().toLocaleDateString()}`,
      content: prompt,
    })

    preview.innerHTML = `
      <h3>${result.title || "Generated Blog"}</h3>
      <div class="blog-content">${result.content || "Blog content generated successfully"}</div>
    `
    showToast("Blog generated successfully")
  } catch (error) {
    document.getElementById("blog-preview").innerHTML =
      '<div class="preview-placeholder"><i class="fas fa-exclamation-triangle"></i><p>Failed to generate blog</p></div>'
    showToast("Failed to generate blog", "error")
  } finally {
    hideLoading()
  }
}

function openBlogGeneratorModal() {
  openModal(
    "Generate Blog",
    `
    <div class="form-row">
      <textarea id="modal-blog-prompt" placeholder="Enter blog topic or prompt..." rows="4"></textarea>
    </div>
    <div class="form-row">
      <select id="modal-blog-length">
        <option value="short">Short (500-800 words)</option>
        <option value="medium">Medium (800-1500 words)</option>
        <option value="long">Long (1500+ words)</option>
      </select>
      <select id="modal-blog-tone">
        <option value="professional">Professional</option>
        <option value="casual">Casual</option>
        <option value="technical">Technical</option>
        <option value="creative">Creative</option>
      </select>
    </div>
    <div class="form-row">
      <button class="btn btn-success" onclick="generateBlogFromModal()">Generate Blog</button>
    </div>
  `,
  )
}

async function generateBlogFromModal() {
  const prompt = document.getElementById("modal-blog-prompt").value
  const length = document.getElementById("modal-blog-length").value
  const tone = document.getElementById("modal-blog-tone").value

  if (!prompt.trim()) {
    showToast("Please enter a blog prompt", "warning")
    return
  }

  try {
    showLoading()
    await fetchAPI("/admin/blog", "POST", {
      prompt,
      length,
      tone,
      title: `Generated Blog - ${new Date().toLocaleDateString()}`,
      content: prompt,
    })
    showToast("Blog generated and saved successfully")
    closeModal()
    await loadBlogsView()
  } catch (error) {
    showToast("Failed to generate blog", "error")
  } finally {
    hideLoading()
  }
}

async function publishBlog(blogId, platform) {
  try {
    showLoading()
    await fetchAPI("/admin/blog/publish-now", "POST", {
      blog_id: blogId,
      platform: platform,
    })
    showToast(`Blog published to ${platform} successfully`)
    await loadBlogsView()
  } catch (error) {
    showToast(`Failed to publish blog to ${platform}`, "error")
  } finally {
    hideLoading()
  }
}

async function viewBlog(blogId) {
  try {
    const blog = await fetchAPI(`/admin/blog/${blogId}`)
    openModal(
      "Blog Content",
      `
      <div class="blog-content">
        <h2>${blog.title}</h2>
        <div class="blog-meta">
          <small>Created: ${formatTime(blog.created_at)} | Length: ${blog.length} | Tone: ${blog.tone}</small>
        </div>
        <div class="blog-text">${blog.content}</div>
      </div>
    `,
    )
  } catch (error) {
    showToast("Failed to load blog content", "error")
  }
}

// Settings View
async function loadSettingsView() {
  try {
    const settings = await fetchAPI("/admin/settings")
    updateSettingsForm(settings)
    await refreshLogs()
    attachSettingsEventListeners()
  } catch (error) {
    console.error("Failed to load settings:", error)
    showToast("Failed to load settings", "error")
  }
}

function updateSettingsForm(settings) {
  document.getElementById("maintenance-mode").checked = settings.maintenanceMode || false
  document.getElementById("dev-mode").checked = settings.devMode || false
  document.getElementById("enable-image-generation").checked = settings.enableImageGeneration !== false
  document.getElementById("enable-video-generation").checked = settings.enableVideoGeneration !== false
  document.getElementById("supabase-url").value = settings.supabaseUrl || ""
  document.getElementById("replicate-key").value = settings.replicateKey || ""
  document.getElementById("openai-key").value = settings.openaiKey || ""
}

function attachSettingsEventListeners() {
  // Log controls
  document.getElementById("log-type-filter").addEventListener("change", refreshLogs)
}

async function saveSettings() {
  try {
    showLoading()

    const settings = {
      maintenanceMode: document.getElementById("maintenance-mode").checked,
      devMode: document.getElementById("dev-mode").checked,
      enableImageGeneration: document.getElementById("enable-image-generation").checked,
      enableVideoGeneration: document.getElementById("enable-video-generation").checked,
      replicateKey: document.getElementById("replicate-key").value,
      openaiKey: document.getElementById("openai-key").value,
    }

    await fetchAPI("/admin/settings", "POST", settings)
    showToast("Settings saved successfully")

    // Update system mode badge
    const systemMode = settings.maintenanceMode ? "MAINTENANCE" : settings.devMode ? "DEV" : "LIVE"
    document.getElementById("system-mode").textContent = systemMode
    document.getElementById("system-mode").className = `mode-badge ${systemMode.toLowerCase()}`
  } catch (error) {
    showToast("Failed to save settings", "error")
  } finally {
    hideLoading()
  }
}

async function refreshLogs() {
  try {
    const logType = document.getElementById("log-type-filter").value
    const logs = await fetchAPI(`/admin/logs?type=${logType}`)
    document.getElementById("system-logs-content").textContent = logs.content || logs.logs || "No logs available"
  } catch (error) {
    document.getElementById("system-logs-content").textContent = "Failed to load logs"
  }
}

async function clearLogs() {
  if (!confirm("Are you sure you want to clear all logs?")) return

  try {
    showLoading()
    await fetchAPI("/admin/logs", "DELETE")
    document.getElementById("system-logs-content").textContent = "Logs cleared"
    showToast("Logs cleared successfully")
  } catch (error) {
    showToast("Failed to clear logs", "error")
  } finally {
    hideLoading()
  }
}

async function clearQueue() {
  if (!confirm("Are you sure you want to clear the post queue? This action cannot be undone.")) return

  try {
    showLoading()
    const result = await fetchAPI("/admin/queue/clear", "DELETE")
    showToast(`Cleared ${result.cleared || 0} posts from queue`)
  } catch (error) {
    showToast("Failed to clear queue", "error")
  } finally {
    hideLoading()
  }
}

async function restartSystem() {
  if (!confirm("Are you sure you want to restart the system? This will cause temporary downtime.")) return

  try {
    showLoading()
    await fetchAPI("/admin/system/restart", "POST")
    showToast("System restart initiated")
  } catch (error) {
    showToast("Failed to restart system", "error")
  } finally {
    hideLoading()
  }
}

// Modal functions
function openModal(title, content) {
  const modal = document.getElementById("modal-overlay")
  const modalContent = document.getElementById("modal-content")

  modalContent.innerHTML = `
    <div class="modal-header">
      <h3>${title}</h3>
      <button class="modal-close" onclick="closeModal()">&times;</button>
    </div>
    <div class="modal-body">
      ${content}
    </div>
  `

  modal.classList.add("active")
}

function closeModal() {
  document.getElementById("modal-overlay").classList.remove("active")
}

// Utility functions
async function fetchAPI(endpoint, method = "GET", data = null, queryParams = "") {
  const url = endpoint + queryParams
  const options = {
    method,
    headers: {
      "Content-Type": "application/json",
    },
  }

  if (data && method !== "GET") {
    options.body = JSON.stringify(data)
  }

  try {
    const response = await fetch(url, options)

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    const responseData = await response.json()
    return responseData
  } catch (error) {
    console.error(`API Error for ${endpoint}:`, error)
    throw error
  }
}

function showLoading() {
  document.getElementById("loading-overlay").classList.add("active")
}

function hideLoading() {
  document.getElementById("loading-overlay").classList.remove("active")
}

function showToast(message, type = "success") {
  const toast = document.createElement("div")
  toast.className = `toast ${type}`
  toast.textContent = message
  document.body.appendChild(toast)

  setTimeout(() => {
    toast.remove()
  }, 3000)
}

function formatTime(timestamp) {
  if (!timestamp) return "N/A"
  const date = new Date(timestamp)
  return date.toLocaleDateString() + " " + date.toLocaleTimeString()
}

function truncateText(text, maxLength) {
  if (!text) return ""
  if (text.length <= maxLength) return text
  return text.substring(0, maxLength) + "..."
}

// Initialize auto-refresh
function startAutoRefresh() {
  refreshInterval = setInterval(() => {
    if (currentSection === "dashboard") {
      loadDashboardView()
    } else if (currentSection === "posts") {
      loadPostsView()
    } else if (currentSection === "notifications") {
      loadNotificationsView()
    } else if (currentSection === "rewards") {
      loadRewardsView()
    } else if (currentSection === "engagement") {
      loadEngagementView()
    } else if (currentSection === "users") {
      loadUsersView()
    } else if (currentSection === "bots") {
      loadBotsView()
    } else if (currentSection === "blogs") {
      loadBlogsView()
    } else if (currentSection === "settings") {
      loadSettingsView()
    }
  }, 60000) // Refresh every 60 seconds
}

// Stop auto-refresh
function stopAutoRefresh() {
  clearInterval(refreshInterval)
}

// Style Add New Post modal to perfection
window.showModal = function(html) {
  document.getElementById('modal-content').innerHTML = html
  document.getElementById('modal-overlay').style.display = 'flex'
  // Modal styling
  const modal = document.getElementById('modal-content')
  modal.style.maxWidth = '480px'
  modal.style.margin = 'auto'
  modal.style.background = '#fff'
  modal.style.borderRadius = '14px'
  modal.style.boxShadow = '0 8px 32px rgba(0,0,0,0.18)'
  modal.style.padding = '2em'
  modal.style.fontSize = '1.05em'
  // Style form fields
  modal.querySelectorAll('input, select, textarea').forEach(el => {
    el.style.marginBottom = '1em'
    el.style.padding = '0.7em'
    el.style.borderRadius = '7px'
    el.style.border = '1px solid #e2e8f0'
    el.style.fontSize = '1em'
    el.style.width = '100%'
    el.style.boxSizing = 'border-box'
  })
  // Style buttons
  modal.querySelectorAll('button').forEach(btn => {
    btn.style.borderRadius = '7px'
    btn.style.border = 'none'
    btn.style.padding = '0.7em 1.3em'
    btn.style.fontSize = '1em'
    btn.style.cursor = 'pointer'
    btn.style.marginRight = '0.5em'
    btn.style.background = btn.classList.contains('btn-primary') ? '#2563eb' : '#e2e8f0'
    btn.style.color = btn.classList.contains('btn-primary') ? '#fff' : '#222'
    btn.style.transition = 'background 0.2s'
  })
}

// Make filter by platform and status functional
document.getElementById("platform-filter").addEventListener("change", filterPosts)
document.getElementById("status-filter").addEventListener("change", filterPosts)

async function filterPosts() {
  const platformFilter = document.getElementById("platform-filter").value
  const statusFilter = document.getElementById("status-filter").value

  // Fetch all posts and filter client-side (or server-side if API supports)
  try {
    const posts = await fetchAPI("/admin/queue")
    let filtered = posts
    if (platformFilter !== "all") {
      filtered = filtered.filter(p => (p.platform || "").toLowerCase() === platformFilter)
    }
    if (statusFilter !== "all") {
      filtered = filtered.filter(p => (p.status || "").toLowerCase() === statusFilter)
    }
    renderPostsTable(filtered)
    attachPostsEventListeners()
  } catch (error) {
    showToast("Failed to filter posts", "error")
  }
}
