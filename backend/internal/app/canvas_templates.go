package app

import (
	"encoding/json"
	"errors"
	"net/url"
	"path"
	"strings"
	"time"
	"unicode"
	"unicode/utf8"

	"yingce/backend/internal/assets"
	"yingce/backend/internal/canvas"
	"yingce/backend/internal/model"
	"yingce/backend/internal/repository"

	"gorm.io/gorm"
)

// 首页作品区分类，与前端 HOME_GALLERY_CATEGORIES 中除「精选」外的 key 一致。
var canvasTemplateCategories = map[string]bool{"drama": true, "film": true, "anime": true, "ads": true, "graphic": true, "ecommerce": true}

var canvasTemplateReportReasons = map[string]bool{"porn": true, "infringement": true, "illegal": true, "discomfort": true, "spam": true, "other": true}

const (
	canvasTemplateTitleMax       = 40
	canvasTemplateDescriptionMax = 500
	canvasTemplateTagMax         = 12
	canvasTemplateTagsMax        = 5
	canvasTemplatePendingMax     = 5
	canvasTemplateReviewNoteMax  = 300
	canvasTemplateReportMax      = 300
	canvasTemplateDefaultAuthor  = "造幕 创作者"
)

type CanvasTemplateSubmitRequest struct {
	Ecommerce       *EcommerceWorkMetadata `json:"ecommerce,omitempty"`
	CanvasID        string                 `json:"canvasId"`
	Title           string                 `json:"title"`
	Description     string                 `json:"description"`
	Category        string                 `json:"category"`
	Tags            []string               `json:"tags"`
	VideoResourceID string                 `json:"videoResourceId"`
	CoverResourceID string                 `json:"coverResourceId"`
	AllowDownload   bool                   `json:"allowDownload"`
}

type CanvasTemplateAuthor struct {
	AvatarMode   string `json:"avatarMode,omitempty"`
	AvatarPreset string `json:"avatarPreset,omitempty"`
	ID           string `json:"id"`
	DisplayName  string `json:"displayName"`
	AvatarURL    string `json:"avatarUrl,omitempty"`
	Username     string `json:"username,omitempty"`
	Followed     bool   `json:"followed"`
	IsSelf       bool   `json:"isSelf"`
}

type CanvasTemplateCard struct {
	Ecommerce       *EcommerceWorkMetadata `json:"ecommerce,omitempty"`
	ID              string                 `json:"id"`
	CanvasID        string                 `json:"canvasId,omitempty"`
	Title           string                 `json:"title"`
	Description     string                 `json:"description"`
	Category        string                 `json:"category"`
	Tags            []string               `json:"tags"`
	CoverURL        string                 `json:"coverUrl"`
	CoverThumbURL   string                 `json:"coverThumbUrl"`
	VideoURL        string                 `json:"videoUrl"`
	VideoDurationMs int64                  `json:"videoDurationMs"`
	VideoWidth      int                    `json:"videoWidth"`
	VideoHeight     int                    `json:"videoHeight"`
	VideoBytes      int64                  `json:"videoBytes"`
	AllowDownload   bool                   `json:"allowDownload"`
	NodeCount       int                    `json:"nodeCount"`
	ConnectionCount int                    `json:"connectionCount"`
	LikeCount       int64                  `json:"likeCount"`
	Liked           bool                   `json:"liked"`
	Status          string                 `json:"status"`
	ReviewNote      string                 `json:"reviewNote,omitempty"`
	ReportCount     int64                  `json:"reportCount,omitempty"`
	Author          CanvasTemplateAuthor   `json:"author"`
	PublishedAt     *time.Time             `json:"publishedAt,omitempty"`
	ReviewedAt      *time.Time             `json:"reviewedAt,omitempty"`
	CreatedAt       time.Time              `json:"createdAt"`
}

type CanvasTemplateList struct {
	Items    []CanvasTemplateCard `json:"items"`
	Total    int64                `json:"total"`
	Page     int                  `json:"page"`
	PageSize int                  `json:"pageSize"`
	Counts   map[string]int64     `json:"counts,omitempty"`
}

type CanvasTemplateQuery struct {
	Status   string
	Category string
	Keyword  string
	Page     int
	PageSize int
}

type CanvasTemplateCanvas struct {
	Project map[string]any `json:"project"`
}

type CanvasTemplateReviewRequest struct {
	Action string `json:"action"`
	Note   string `json:"note"`
}

type CanvasTemplateReportRequest struct {
	Reason string `json:"reason"`
	Detail string `json:"detail"`
}

type CanvasTemplateReportItem struct {
	Reason    string    `json:"reason"`
	Detail    string    `json:"detail"`
	CreatedAt time.Time `json:"createdAt"`
}

type AdminCanvasTemplateDetail struct {
	Template CanvasTemplateCard         `json:"template"`
	Project  map[string]any             `json:"project"`
	Reports  []CanvasTemplateReportItem `json:"reports"`
}

type CanvasTemplateLikeResult struct {
	Liked     bool  `json:"liked"`
	LikeCount int64 `json:"likeCount"`
}

type UserFollowResult struct {
	Followed bool `json:"followed"`
}

type canvasTemplateScope int

const (
	canvasTemplateScopePublic canvasTemplateScope = iota
	canvasTemplateScopeOwner
	canvasTemplateScopeAdmin
)

func publicCanvasTemplateResourceURL(templateID string, resourceID string) string {
	return "/api/public/canvas-templates/" + url.PathEscape(templateID) + "/resources/" + url.PathEscape(resourceID) + "/file"
}

func adminCanvasTemplateResourceURL(templateID string, resourceID string) string {
	return "/api/admin/canvas-templates/" + url.PathEscape(templateID) + "/resources/" + url.PathEscape(resourceID) + "/file"
}

func ownerCanvasTemplateResourceURL(_ string, resourceID string) string {
	return "/api/resources/" + url.PathEscape(resourceID) + "/file"
}

func (scope canvasTemplateScope) resourceURL(templateID string, resourceID string) string {
	switch scope {
	case canvasTemplateScopeAdmin:
		return adminCanvasTemplateResourceURL(templateID, resourceID)
	case canvasTemplateScopeOwner:
		return ownerCanvasTemplateResourceURL(templateID, resourceID)
	default:
		return publicCanvasTemplateResourceURL(templateID, resourceID)
	}
}

// SubmitCanvasTemplate 把当前画布冻结为模版投稿，进入待审核队列。
// 同一画布仍在审核中的旧投稿会被新投稿替换。
func (s *Service) SubmitCanvasTemplate(user *model.User, req CanvasTemplateSubmitRequest) (CanvasTemplateCard, error) {
	if user == nil {
		return CanvasTemplateCard{}, Unauthorized("请先登录")
	}
	if req.Ecommerce != nil {
		return s.submitEcommerceWork(user, req)
	}
	title, fits := normalizeCanvasTemplateText(req.Title, canvasTemplateTitleMax, false)
	if title == "" {
		return CanvasTemplateCard{}, BadAuthRequest("请填写模版名称")
	}
	if !fits {
		return CanvasTemplateCard{}, BadAuthRequest("模版名称不能超过 40 个字")
	}
	description, fits := normalizeCanvasTemplateText(req.Description, canvasTemplateDescriptionMax, true)
	if !fits {
		return CanvasTemplateCard{}, BadAuthRequest("作品简介不能超过 500 个字")
	}
	category := strings.TrimSpace(req.Category)
	if !canvasTemplateCategories[category] {
		return CanvasTemplateCard{}, BadAuthRequest("请选择作品分类")
	}
	tags, err := normalizeCanvasTemplateTags(req.Tags)
	if err != nil {
		return CanvasTemplateCard{}, err
	}
	project, err := s.repo.CanvasProjectForUser(user.ID, strings.TrimSpace(req.CanvasID))
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return CanvasTemplateCard{}, NotFound("画布不存在或无权访问")
	}
	if err != nil {
		return CanvasTemplateCard{}, err
	}
	video, err := s.canvasTemplateUpload(user.ID, req.VideoResourceID, "video", "成片视频")
	if err != nil {
		return CanvasTemplateCard{}, err
	}
	cover, err := s.canvasTemplateUpload(user.ID, req.CoverResourceID, "image", "封面")
	if err != nil {
		return CanvasTemplateCard{}, err
	}
	// 只保存白名单投影：聊天记录、任务与密钥类字段不进入模版；媒体以 resource:ID 保存，展示时再改写为受控地址。
	document, resources, err := canvas.PublicCanvasDocument(project.PayloadJSON, project.Title, canvas.PublicCanvasOptions{
		ResourceURL:     func(resourceID string) string { return "resource:" + resourceID },
		IncludePreviews: true,
	})
	if err != nil {
		return CanvasTemplateCard{}, BadAuthRequest("画布数据无法读取，请刷新画布后重试")
	}
	nodes, _ := document["nodes"].([]any)
	connections, _ := document["connections"].([]any)
	if len(nodes) == 0 {
		return CanvasTemplateCard{}, BadAuthRequest("画布还没有内容，请先完成创作再上传模版")
	}
	pending, err := s.repo.CountUserCanvasTemplates(user.ID, model.CanvasTemplateStatusPending, project.ID)
	if err != nil {
		return CanvasTemplateCard{}, err
	}
	if pending >= canvasTemplatePendingMax {
		return CanvasTemplateCard{}, NewAppError(429, "你已有 5 个模版正在审核中，请等待审核结果后再提交")
	}
	payload, err := json.Marshal(document)
	if err != nil {
		return CanvasTemplateCard{}, err
	}
	tagsJSON, _ := json.Marshal(tags)
	resourceIDs := make([]string, 0, len(resources)+2)
	resourceIDs = append(resourceIDs, video.ID, cover.ID)
	for id := range resources {
		resourceIDs = append(resourceIDs, id)
	}
	template := &model.CanvasTemplate{
		ID:              newID(),
		UserID:          user.ID,
		CanvasID:        project.ID,
		Title:           title,
		Description:     description,
		Category:        category,
		TagsJSON:        string(tagsJSON),
		VideoResourceID: video.ID,
		CoverResourceID: cover.ID,
		VideoDurationMs: video.DurationMs,
		VideoWidth:      video.Width,
		VideoHeight:     video.Height,
		VideoBytes:      video.Size,
		AllowDownload:   req.AllowDownload,
		PayloadJSON:     string(payload),
		NodeCount:       len(nodes),
		ConnectionCount: len(connections),
		Status:          model.CanvasTemplateStatusPending,
	}
	if err := s.repo.ReplacePendingCanvasTemplate(template, resourceIDs); err != nil {
		return CanvasTemplateCard{}, err
	}
	cards, err := s.canvasTemplateCards(user, []model.CanvasTemplate{*template}, canvasTemplateScopeOwner)
	if err != nil {
		return CanvasTemplateCard{}, err
	}
	return cards[0], nil
}

// MyCanvasTemplates 返回当前用户的投稿记录（可按画布过滤），用于展示审核进度。
func (s *Service) MyCanvasTemplates(user *model.User, canvasID string) ([]CanvasTemplateCard, error) {
	if user == nil {
		return nil, Unauthorized("请先登录")
	}
	templates, _, err := s.repo.QueryCanvasTemplates(repository.CanvasTemplateFilter{UserID: user.ID, CanvasID: strings.TrimSpace(canvasID), Limit: 20})
	if err != nil {
		return nil, err
	}
	return s.canvasTemplateCards(user, templates, canvasTemplateScopeOwner)
}

func (s *Service) PublicCanvasTemplates(viewer *model.User, query CanvasTemplateQuery) (CanvasTemplateList, error) {
	category := strings.TrimSpace(query.Category)
	if category == "featured" {
		category = ""
	}
	if category != "" && !canvasTemplateCategories[category] {
		return CanvasTemplateList{}, BadAuthRequest("作品分类无效")
	}
	page, pageSize := canvasTemplatePage(query.Page, query.PageSize, 24, 100)
	keyword, _ := normalizeCanvasTemplateText(query.Keyword, 40, false)
	templates, total, err := s.repo.QueryCanvasTemplates(repository.CanvasTemplateFilter{
		Statuses:    []model.CanvasTemplateStatus{model.CanvasTemplateStatusApproved},
		Category:    category,
		Keyword:     keyword,
		Page:        page,
		Limit:       pageSize,
		ByPublished: true,
	})
	if err != nil {
		return CanvasTemplateList{}, err
	}
	cards, err := s.canvasTemplateCards(viewer, templates, canvasTemplateScopePublic)
	if err != nil {
		return CanvasTemplateList{}, err
	}
	return CanvasTemplateList{Items: cards, Total: total, Page: page, PageSize: pageSize}, nil
}

func (s *Service) PublicCanvasTemplate(viewer *model.User, id string) (CanvasTemplateCard, error) {
	template, err := s.approvedCanvasTemplate(id)
	if err != nil {
		return CanvasTemplateCard{}, err
	}
	cards, err := s.canvasTemplateCards(viewer, []model.CanvasTemplate{*template}, canvasTemplateScopePublic)
	if err != nil {
		return CanvasTemplateCard{}, err
	}
	return cards[0], nil
}

func (s *Service) PublicCanvasTemplateCanvas(id string) (CanvasTemplateCanvas, error) {
	template, err := s.repo.CanvasTemplate(strings.TrimSpace(id))
	if errors.Is(err, gorm.ErrRecordNotFound) || (err == nil && template.Status != model.CanvasTemplateStatusApproved) {
		return CanvasTemplateCanvas{}, NotFound("作品不存在或已下架")
	}
	if err != nil {
		return CanvasTemplateCanvas{}, err
	}
	project, err := canvasTemplateDocument(template, canvasTemplateScopePublic)
	if err != nil {
		return CanvasTemplateCanvas{}, err
	}
	return CanvasTemplateCanvas{Project: project}, nil
}

func (s *Service) PreparePublicCanvasTemplateResourceDelivery(templateID string, resourceID string, options ResourceAccessOptions, rangeHeader string) (*ResourceDelivery, error) {
	template, err := s.approvedCanvasTemplate(templateID)
	if err != nil {
		return nil, err
	}
	return s.prepareCanvasTemplateResourceDelivery(template, resourceID, options, rangeHeader, false)
}

func (s *Service) PrepareAdminCanvasTemplateResourceDelivery(actor *model.User, templateID string, resourceID string, options ResourceAccessOptions, rangeHeader string) (*ResourceDelivery, error) {
	if err := s.RequireAdmin(actor); err != nil {
		return nil, err
	}
	template, err := s.canvasTemplateSummary(templateID)
	if err != nil {
		return nil, err
	}
	return s.prepareCanvasTemplateResourceDelivery(template, resourceID, options, rangeHeader, true)
}

// prepareCanvasTemplateResourceDelivery 只分发投稿时登记过的资源，并以作者身份签发访问地址。
func (s *Service) prepareCanvasTemplateResourceDelivery(template *model.CanvasTemplate, resourceID string, options ResourceAccessOptions, rangeHeader string, admin bool) (*ResourceDelivery, error) {
	resourceID = assets.ValidID(resourceID)
	if resourceID == "" {
		return nil, NotFound("资源不存在")
	}
	switch options.Purpose {
	case "", assets.PurposeDisplay:
		options.Purpose = assets.PurposeDisplay
	case assets.PurposeDownload:
		if resourceID != template.VideoResourceID || (!template.AllowDownload && !admin) {
			return nil, Forbidden("作者未开放下载")
		}
	default:
		return nil, BadAuthRequest("不支持的资源用途")
	}
	allowed, err := s.repo.CanvasTemplateHasResource(template.ID, resourceID)
	if err != nil {
		return nil, err
	}
	if !allowed {
		return nil, NotFound("资源不存在")
	}
	resource, err := s.repo.ResourceForUser(template.UserID, resourceID)
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, NotFound("资源不存在或已被作者删除")
	}
	if err != nil {
		return nil, err
	}
	if options.Purpose == assets.PurposeDownload && options.DownloadName == "" {
		options.DownloadName = canvasTemplateDownloadName(template.Title, resource.MimeType)
	}
	return s.prepareResourceDelivery(template.UserID, resource, options, rangeHeader)
}

func (s *Service) AdminCanvasTemplates(actor *model.User, query CanvasTemplateQuery) (CanvasTemplateList, error) {
	if err := s.RequireAdmin(actor); err != nil {
		return CanvasTemplateList{}, err
	}
	status := strings.TrimSpace(query.Status)
	var statuses []model.CanvasTemplateStatus
	switch model.CanvasTemplateStatus(status) {
	case "", "all":
	case model.CanvasTemplateStatusPending, model.CanvasTemplateStatusApproved, model.CanvasTemplateStatusRejected, model.CanvasTemplateStatusOffline:
		statuses = []model.CanvasTemplateStatus{model.CanvasTemplateStatus(status)}
	default:
		return CanvasTemplateList{}, BadAuthRequest("审核状态无效")
	}
	category := strings.TrimSpace(query.Category)
	if category != "" && !canvasTemplateCategories[category] {
		return CanvasTemplateList{}, BadAuthRequest("作品分类无效")
	}
	page, pageSize := canvasTemplatePage(query.Page, query.PageSize, 24, 100)
	keyword, _ := normalizeCanvasTemplateText(query.Keyword, 80, false)
	templates, total, err := s.repo.QueryCanvasTemplates(repository.CanvasTemplateFilter{
		Statuses:        statuses,
		Category:        category,
		Keyword:         keyword,
		IncludeUsername: true,
		Page:            page,
		Limit:           pageSize,
		OldestFirst:     status == string(model.CanvasTemplateStatusPending),
	})
	if err != nil {
		return CanvasTemplateList{}, err
	}
	counts, err := s.repo.CountCanvasTemplatesByStatus()
	if err != nil {
		return CanvasTemplateList{}, err
	}
	cards, err := s.canvasTemplateCards(actor, templates, canvasTemplateScopeAdmin)
	if err != nil {
		return CanvasTemplateList{}, err
	}
	return CanvasTemplateList{Items: cards, Total: total, Page: page, PageSize: pageSize, Counts: counts}, nil
}

// AdminCanvasTemplate 返回审核大弹窗需要的全部内容：模版信息、完整只读画布和举报记录。
func (s *Service) AdminCanvasTemplate(actor *model.User, id string) (AdminCanvasTemplateDetail, error) {
	if err := s.RequireAdmin(actor); err != nil {
		return AdminCanvasTemplateDetail{}, err
	}
	template, err := s.repo.CanvasTemplate(strings.TrimSpace(id))
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return AdminCanvasTemplateDetail{}, NotFound("模版不存在")
	}
	if err != nil {
		return AdminCanvasTemplateDetail{}, err
	}
	project, err := canvasTemplateDocument(template, canvasTemplateScopeAdmin)
	if err != nil {
		return AdminCanvasTemplateDetail{}, err
	}
	summary := *template
	if template.Category != "ecommerce" {
		summary.PayloadJSON = ""
	}
	cards, err := s.canvasTemplateCards(actor, []model.CanvasTemplate{summary}, canvasTemplateScopeAdmin)
	if err != nil {
		return AdminCanvasTemplateDetail{}, err
	}
	rawReports, err := s.repo.CanvasTemplateReports(template.ID, 50)
	if err != nil {
		return AdminCanvasTemplateDetail{}, err
	}
	reports := make([]CanvasTemplateReportItem, 0, len(rawReports))
	for _, report := range rawReports {
		reports = append(reports, CanvasTemplateReportItem{Reason: report.Reason, Detail: report.Detail, CreatedAt: report.CreatedAt})
	}
	return AdminCanvasTemplateDetail{Template: cards[0], Project: project, Reports: reports}, nil
}

// ReviewCanvasTemplate 执行审核动作：approve 上架（重新上架也会刷新上架时间），reject 驳回待审核投稿，offline 下架已上架作品。
func (s *Service) ReviewCanvasTemplate(actor *model.User, id string, req CanvasTemplateReviewRequest) (CanvasTemplateCard, error) {
	if err := s.RequireAdmin(actor); err != nil {
		return CanvasTemplateCard{}, err
	}
	note, fits := normalizeCanvasTemplateText(req.Note, canvasTemplateReviewNoteMax, true)
	if !fits {
		return CanvasTemplateCard{}, BadAuthRequest("审核说明不能超过 300 个字")
	}
	template, err := s.canvasTemplateSummary(id)
	if err != nil {
		return CanvasTemplateCard{}, err
	}
	now := time.Now()
	updates := map[string]any{"reviewed_at": now, "reviewed_by": actor.ID, "review_note": note}
	var from []model.CanvasTemplateStatus
	switch strings.TrimSpace(req.Action) {
	case "approve":
		from = []model.CanvasTemplateStatus{model.CanvasTemplateStatusPending, model.CanvasTemplateStatusRejected, model.CanvasTemplateStatusOffline}
		updates["status"] = model.CanvasTemplateStatusApproved
		updates["published_at"] = now
	case "reject":
		if note == "" {
			return CanvasTemplateCard{}, BadAuthRequest("请填写不通过的原因，作者会看到这条说明")
		}
		from = []model.CanvasTemplateStatus{model.CanvasTemplateStatusPending}
		updates["status"] = model.CanvasTemplateStatusRejected
	case "offline":
		from = []model.CanvasTemplateStatus{model.CanvasTemplateStatusApproved}
		updates["status"] = model.CanvasTemplateStatusOffline
	default:
		return CanvasTemplateCard{}, BadAuthRequest("审核操作无效")
	}
	changed, err := s.repo.UpdateCanvasTemplateReview(template.ID, from, updates)
	if err != nil {
		return CanvasTemplateCard{}, err
	}
	if !changed {
		return CanvasTemplateCard{}, NewAppError(409, "模版状态已变化，请刷新后重试")
	}
	template, err = s.canvasTemplateSummary(template.ID)
	if err != nil {
		return CanvasTemplateCard{}, err
	}
	cards, err := s.canvasTemplateCards(actor, []model.CanvasTemplate{*template}, canvasTemplateScopeAdmin)
	if err != nil {
		return CanvasTemplateCard{}, err
	}
	return cards[0], nil
}

func (s *Service) SetCanvasTemplateLike(user *model.User, id string, liked bool) (CanvasTemplateLikeResult, error) {
	if user == nil {
		return CanvasTemplateLikeResult{}, Unauthorized("请先登录")
	}
	template, err := s.approvedCanvasTemplate(id)
	if err != nil {
		return CanvasTemplateLikeResult{}, err
	}
	count, err := s.repo.SetCanvasTemplateLike(template.ID, user.ID, liked)
	if err != nil {
		return CanvasTemplateLikeResult{}, err
	}
	return CanvasTemplateLikeResult{Liked: liked, LikeCount: count}, nil
}

// SetUserFollow 关注或取消关注作者。只能关注有已上架作品的用户，避免借接口探测任意用户 ID。
func (s *Service) SetUserFollow(user *model.User, targetID string, followed bool) (UserFollowResult, error) {
	if user == nil {
		return UserFollowResult{}, Unauthorized("请先登录")
	}
	targetID = assets.ValidID(strings.TrimSpace(targetID))
	if targetID == "" {
		return UserFollowResult{}, NotFound("用户不存在")
	}
	if targetID == user.ID {
		return UserFollowResult{}, BadAuthRequest("不能关注自己")
	}
	if followed {
		exists, err := s.repo.UserHasCanvasTemplateWithStatus(targetID, model.CanvasTemplateStatusApproved)
		if err != nil {
			return UserFollowResult{}, err
		}
		if !exists {
			return UserFollowResult{}, NotFound("用户不存在")
		}
	}
	if err := s.repo.SetUserFollow(user.ID, targetID, followed); err != nil {
		return UserFollowResult{}, err
	}
	return UserFollowResult{Followed: followed}, nil
}

func (s *Service) ReportCanvasTemplate(user *model.User, id string, req CanvasTemplateReportRequest) error {
	if user == nil {
		return Unauthorized("请先登录")
	}
	template, err := s.approvedCanvasTemplate(id)
	if err != nil {
		return err
	}
	if template.UserID == user.ID {
		return BadAuthRequest("不能举报自己的作品")
	}
	reason := strings.TrimSpace(req.Reason)
	if !canvasTemplateReportReasons[reason] {
		return BadAuthRequest("请选择举报原因")
	}
	detail, fits := normalizeCanvasTemplateText(req.Detail, canvasTemplateReportMax, true)
	if !fits {
		return BadAuthRequest("补充说明不能超过 300 个字")
	}
	return s.repo.UpsertCanvasTemplateReport(&model.CanvasTemplateReport{ID: newID(), TemplateID: template.ID, UserID: user.ID, Reason: reason, Detail: detail, CreatedAt: time.Now()})
}

func (s *Service) approvedCanvasTemplate(id string) (*model.CanvasTemplate, error) {
	template, err := s.repo.CanvasTemplateSummary(strings.TrimSpace(id))
	if errors.Is(err, gorm.ErrRecordNotFound) || (err == nil && template.Status != model.CanvasTemplateStatusApproved) {
		return nil, NotFound("作品不存在或已下架")
	}
	return template, err
}

func (s *Service) canvasTemplateSummary(id string) (*model.CanvasTemplate, error) {
	template, err := s.repo.CanvasTemplateSummary(strings.TrimSpace(id))
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, NotFound("模版不存在")
	}
	return template, err
}

func (s *Service) canvasTemplateUpload(userID string, id string, kind string, label string) (*model.Resource, error) {
	id = assets.ValidID(strings.TrimSpace(id))
	if id == "" {
		return nil, BadAuthRequest("请先上传" + label)
	}
	resource, err := s.repo.ResourceForUser(userID, id)
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, BadAuthRequest(label + "不存在，请重新上传")
	}
	if err != nil {
		return nil, err
	}
	if resource.Status != model.ResourceStatusReady {
		return nil, BadAuthRequest(label + "仍在处理中，请稍后再提交")
	}
	if resource.Kind != kind {
		if kind == "video" {
			return nil, BadAuthRequest("成片需要是浏览器可播放的视频文件（推荐 MP4）")
		}
		return nil, BadAuthRequest("封面需要是图片文件")
	}
	return resource, nil
}

func (s *Service) canvasTemplateCards(viewer *model.User, templates []model.CanvasTemplate, scope canvasTemplateScope) ([]CanvasTemplateCard, error) {
	cards := make([]CanvasTemplateCard, 0, len(templates))
	if len(templates) == 0 {
		return cards, nil
	}
	userIDs := make([]string, 0, len(templates))
	templateIDs := make([]string, 0, len(templates))
	seenUsers := map[string]bool{}
	for _, template := range templates {
		templateIDs = append(templateIDs, template.ID)
		if !seenUsers[template.UserID] {
			seenUsers[template.UserID] = true
			userIDs = append(userIDs, template.UserID)
		}
	}
	users, err := s.repo.UsersByIDs(userIDs)
	if err != nil {
		return nil, err
	}
	viewerID := ""
	if viewer != nil {
		viewerID = viewer.ID
	}
	liked, err := s.repo.CanvasTemplatesLikedBy(viewerID, templateIDs)
	if err != nil {
		return nil, err
	}
	followed, err := s.repo.UserFollowees(viewerID, userIDs)
	if err != nil {
		return nil, err
	}
	for _, template := range templates {
		author := users[template.UserID]
		var tags []string
		if template.TagsJSON != "" {
			_ = json.Unmarshal([]byte(template.TagsJSON), &tags)
		}
		if tags == nil {
			tags = []string{}
		}
		cover := scope.resourceURL(template.ID, template.CoverResourceID)
		card := CanvasTemplateCard{
			ID:              template.ID,
			Title:           template.Title,
			Description:     template.Description,
			Category:        template.Category,
			Tags:            tags,
			CoverURL:        cover,
			CoverThumbURL:   cover + "?variant=thumbnail",
			VideoURL:        scope.resourceURL(template.ID, template.VideoResourceID) + "?variant=playback",
			VideoDurationMs: template.VideoDurationMs,
			VideoWidth:      template.VideoWidth,
			VideoHeight:     template.VideoHeight,
			VideoBytes:      template.VideoBytes,
			AllowDownload:   template.AllowDownload,
			NodeCount:       template.NodeCount,
			ConnectionCount: template.ConnectionCount,
			LikeCount:       template.LikeCount,
			Liked:           liked[template.ID],
			Status:          string(template.Status),
			PublishedAt:     template.PublishedAt,
			CreatedAt:       template.CreatedAt,
			Author: CanvasTemplateAuthor{
				ID:           template.UserID,
				DisplayName:  kernelDefaultAuthorName(author.DisplayName),
				AvatarURL:    publicCanvasTemplateAvatar(author),
				AvatarMode:   author.AvatarMode,
				AvatarPreset: author.AvatarPreset,
				Followed:     followed[template.UserID],
				IsSelf:       viewerID != "" && viewerID == template.UserID,
			},
		}
		if scope != canvasTemplateScopePublic {
			card.CanvasID = template.CanvasID
			card.ReviewNote = template.ReviewNote
			card.ReviewedAt = template.ReviewedAt
		}
		if scope == canvasTemplateScopeAdmin {
			card.ReportCount = template.ReportCount
			card.Author.Username = author.Username
		}
		if template.Category == "ecommerce" {
			var payload struct {
				Ecommerce *EcommerceWorkMetadata `json:"ecommerce"`
			}
			if json.Unmarshal([]byte(template.PayloadJSON), &payload) == nil && payload.Ecommerce != nil {
				card.Ecommerce = payload.Ecommerce
				if card.Ecommerce.ReferenceVideoResourceID != "" {
					card.Ecommerce.ReferenceVideoResourceID = scope.resourceURL(template.ID, card.Ecommerce.ReferenceVideoResourceID)
				}
				for i, id := range card.Ecommerce.ReferenceResourceIDs {
					card.Ecommerce.ReferenceResourceIDs[i] = scope.resourceURL(template.ID, id)
				}
			}
		}
		cards = append(cards, card)
	}
	return cards, nil
}

func canvasTemplateDocument(template *model.CanvasTemplate, scope canvasTemplateScope) (map[string]any, error) {
	project, _, err := canvas.PublicCanvasDocument(template.PayloadJSON, template.Title, canvas.PublicCanvasOptions{
		ResourceURL:     func(resourceID string) string { return scope.resourceURL(template.ID, resourceID) },
		IncludePreviews: true,
	})
	if err != nil {
		return nil, WrapAppError(500, "模版画布数据无效", err)
	}
	project["id"] = template.ID
	project["title"] = template.Title
	return project, nil
}

func kernelDefaultAuthorName(name string) string {
	if name = strings.TrimSpace(name); name != "" {
		return name
	}
	return canvasTemplateDefaultAuthor
}

// publicCanvasTemplateAvatar 只公开平台签发的公开头像地址或 https 头像，其余（含默认头像）交给前端显示首字。
func publicCanvasTemplateAvatar(user model.User) string {
	if user.AvatarMode == "custom" {
		return "/api/public/canvas-authors/" + url.PathEscape(user.ID) + "/avatar?v=" + url.QueryEscape(user.AvatarVersion)
	}
	avatar := strings.TrimSpace(user.AvatarURL)
	if user.AvatarMode == "default" || avatar == "" {
		return ""
	}
	if strings.HasPrefix(avatar, "/api/profile/avatars/") || strings.HasPrefix(avatar, "https://") {
		return avatar
	}
	return ""
}

func canvasTemplateDownloadName(title string, mimeType string) string {
	name := strings.Map(func(r rune) rune {
		if r == '/' || r == '\\' || r == ':' || r == '*' || r == '?' || r == '"' || r == '<' || r == '>' || r == '|' || unicode.IsControl(r) {
			return '_'
		}
		return r
	}, strings.TrimSpace(title))
	if name == "" {
		name = "template"
	}
	extension := ".mp4"
	switch {
	case strings.Contains(mimeType, "webm"):
		extension = ".webm"
	case strings.Contains(mimeType, "quicktime"):
		extension = ".mov"
	}
	if path.Ext(name) == extension {
		return name
	}
	return name + extension
}

func canvasTemplatePage(page int, pageSize int, fallback int, max int) (int, int) {
	if page <= 0 {
		page = 1
	}
	if pageSize <= 0 {
		pageSize = fallback
	}
	if pageSize > max {
		pageSize = max
	}
	return page, pageSize
}

// normalizeCanvasTemplateText 去掉首尾空白和控制字符（多行文本保留换行），返回结果是否在字数上限内。
func normalizeCanvasTemplateText(value string, max int, multiline bool) (string, bool) {
	value = strings.ReplaceAll(value, "\r\n", "\n")
	var builder strings.Builder
	for _, r := range value {
		switch {
		case r == '\n' && multiline:
			builder.WriteRune(r)
		case unicode.IsControl(r):
			builder.WriteRune(' ')
		default:
			builder.WriteRune(r)
		}
	}
	value = strings.TrimSpace(builder.String())
	return value, utf8.RuneCountInString(value) <= max
}

func normalizeCanvasTemplateTags(values []string) ([]string, error) {
	tags := make([]string, 0, len(values))
	seen := map[string]bool{}
	for _, value := range values {
		tag, fits := normalizeCanvasTemplateText(strings.TrimLeft(strings.TrimSpace(value), "#＃"), canvasTemplateTagMax, false)
		if tag == "" {
			continue
		}
		if !fits {
			return nil, BadAuthRequest("每个标签不能超过 12 个字")
		}
		key := strings.ToLower(tag)
		if seen[key] {
			continue
		}
		seen[key] = true
		tags = append(tags, tag)
	}
	if len(tags) > canvasTemplateTagsMax {
		return nil, BadAuthRequest("最多添加 5 个标签")
	}
	return tags, nil
}
