# Schema Migration TODO Checklist

## Phase 1: Schema Layer ✅ COMPLETE

### Core Schemas
- [x] Create `UnifiedArticleBase` base schema
- [x] Create `FeedArticleUnifiedResponse` (detail)
- [x] Create `ClippedArticleUnifiedResponse` (detail)
- [x] Create `FeedArticleUnifiedListResponse` (list)
- [x] Create `ClippedArticleUnifiedListResponse` (list)
- [x] Create `UnifiedArticleResponse` union type
- [x] Create `UnifiedArticleListResponse` union type
- [x] Create `ArticleContentListResponse` (minimal content)
- [x] Create `FeedArticleListResponse` (list variant)
- [x] Create `ClippedArticleListResponse` (list variant)

### URL Type Changes
- [x] Change `ArticleContentBase.link` to `str`
- [x] Change `FeedBase.url` to `str`
- [x] Change `FeedBase.link` to `str`
- [x] Change `FeedBasicInfo.url` to `str`
- [x] Change `FeedResponse.url` to `str` (subscriptions.py)
- [x] Change `FeedResponse.link` to `str` (subscriptions.py)
- [x] Change `SubscriptionFeedResponse.url` to `str`
- [x] Change `SubscriptionFeedResponse.link` to `str`
- [x] Change `ArticleWithStateResponse.link` to `str`
- [x] Keep `AnyUrl` in input schemas (FeedCreate, ArticleContentCreate, etc.)

### Validation Changes
- [x] Remove `check_depth()` from `SaveArticleRequest`
- [x] Keep 100KB size limit in `validate_metadata()`
- [x] Add comment explaining why depth check is unnecessary

### Deprecation
- [x] Mark `ArticleResponse` as deprecated
- [x] Mark `ArticleBase` as deprecated
- [x] Add deprecation warnings in docstrings

### Exports
- [x] Add new schemas to `__init__.py`
- [x] Export all List/Detail variants
- [x] Export polymorphic union types

### Documentation
- [x] Create `SCHEMA_MIGRATION_GUIDE.md`
- [x] Create `SCHEMA_CHANGES_SUMMARY.md`
- [x] Create `SCHEMA_QUICK_REFERENCE.md`
- [x] Create `SCHEMA_ARCHITECTURE_DIAGRAM.md`
- [x] Create `SCHEMA_REFACTORING_COMPLETE.md`
- [x] Create `examples/schema_usage_examples.py`

---

## Phase 2: Service Layer (TODO)

### ArticleTransformer Updates
- [ ] Update `feed_to_unified()` to return `FeedArticleUnifiedResponse`
- [ ] Update `clipped_to_unified()` to return `ClippedArticleUnifiedResponse`
- [ ] Add `feed_to_unified_list()` for list responses
- [ ] Add `clipped_to_unified_list()` for list responses
- [ ] Use `model_validate()` instead of manual field mapping
- [ ] Remove manual dictionary construction

### ArticleManagementService Updates
- [ ] Update `list_articles()` to return `UnifiedArticleListResponse`
- [ ] Update `get_article()` to return `UnifiedArticleResponse`
- [ ] Update `get_unread_articles()` to return `UnifiedArticleListResponse`
- [ ] Update `get_read_later_articles()` to return `UnifiedArticleListResponse`
- [ ] Update `get_recently_read_articles()` to return `UnifiedArticleListResponse`
- [ ] Use `model_validate()` for ORM-to-schema mapping

### FeedManagementService Updates
- [ ] Update `list_feeds()` to use `model_validate()`
- [ ] Remove manual dictionary construction loop
- [ ] Use list comprehension with `model_validate()`

### ClippedArticleService Updates
- [ ] Update `save_article()` to return `ClippedArticleUnifiedResponse`
- [ ] Update `get_article_by_url()` to return `ClippedArticleUnifiedResponse`
- [ ] Use `model_validate()` for responses

### Database Query Updates
- [ ] Add `defer(ArticleContent.content)` to list queries
- [ ] Ensure detail queries load full content
- [ ] Update `get_articles_filtered()` to defer content
- [ ] Update `get_unread_articles()` to defer content
- [ ] Update `get_read_later_articles()` to defer content
- [ ] Update `get_recently_read_articles()` to defer content

---

## Phase 3: API Layer (TODO)

### Article Routers
- [ ] Update `GET /articles` response_model to `PaginatedResponse[UnifiedArticleListResponse]`
- [ ] Update `GET /articles/{id}` response_model to `UnifiedArticleResponse`
- [ ] Update `GET /articles/unread` response_model to `PaginatedResponse[UnifiedArticleListResponse]`
- [ ] Update `GET /articles/read-later` response_model to `PaginatedResponse[UnifiedArticleListResponse]`
- [ ] Update `GET /articles/recently-read` response_model to `PaginatedResponse[UnifiedArticleListResponse]`

### Feed Routers
- [ ] Verify `FeedResponse` uses `str` for URLs
- [ ] Update any manual URL parsing logic
- [ ] Remove unnecessary URL validation on responses

### Clipped Article Routers
- [ ] Update response models to use new schemas
- [ ] Verify list endpoints use List schemas
- [ ] Verify detail endpoints use Detail schemas

### OpenAPI Documentation
- [ ] Update API documentation with new schemas
- [ ] Add examples for discriminated unions
- [ ] Document List vs Detail response differences
- [ ] Update changelog with migration notes

---

## Phase 4: Testing (TODO)

### Unit Tests
- [ ] Test `FeedArticleUnifiedResponse` serialization
- [ ] Test `ClippedArticleUnifiedResponse` serialization
- [ ] Test discriminator selection
- [ ] Test `model_validate()` with ORM objects
- [ ] Test List schemas exclude content field
- [ ] Test Detail schemas include content field
- [ ] Test URL types (str in responses, AnyUrl in inputs)
- [ ] Test metadata validation (size check only)

### Integration Tests
- [ ] Test `GET /articles` returns List responses
- [ ] Test `GET /articles/{id}` returns Detail response
- [ ] Test discriminator works in API responses
- [ ] Test payload sizes are reduced
- [ ] Test no content field in list responses
- [ ] Test content field present in detail responses

### Performance Tests
- [ ] Benchmark list endpoint payload size
- [ ] Benchmark detail endpoint payload size
- [ ] Benchmark serialization time (1000 articles)
- [ ] Benchmark URL parsing overhead (before/after)
- [ ] Benchmark metadata validation (before/after)
- [ ] Compare memory usage (before/after)

### Type Checking
- [ ] Run mypy on updated code
- [ ] Verify discriminator type safety
- [ ] Verify no type errors in service layer
- [ ] Verify no type errors in API layer

---

## Phase 5: Frontend (TODO)

### TypeScript Type Generation
- [ ] Generate new types from updated schemas
- [ ] Create discriminated union types
- [ ] Update API client types
- [ ] Remove nullable type-specific fields

### API Client Updates
- [ ] Update list endpoint calls to expect List responses
- [ ] Update detail endpoint calls to expect Detail responses
- [ ] Handle discriminated unions in TypeScript
- [ ] Remove manual null checks for type-specific fields

### UI Updates
- [ ] Update article list components (no content field)
- [ ] Update article detail components (with content field)
- [ ] Handle feed vs clipped article types
- [ ] Test type safety in TypeScript

---

## Phase 6: Deployment (TODO)

### Staging Deployment
- [ ] Deploy schema changes to staging
- [ ] Deploy service layer changes to staging
- [ ] Deploy API layer changes to staging
- [ ] Run integration tests on staging
- [ ] Run performance tests on staging
- [ ] Verify frontend works on staging

### Production Deployment
- [ ] Deploy backend changes to production
- [ ] Monitor error rates
- [ ] Monitor response times
- [ ] Monitor payload sizes
- [ ] Deploy frontend changes to production
- [ ] Monitor user experience metrics

### Monitoring
- [ ] Set up alerts for increased error rates
- [ ] Set up alerts for increased response times
- [ ] Monitor bandwidth usage
- [ ] Monitor CPU usage
- [ ] Track performance improvements

---

## Phase 7: Cleanup (TODO)

### Deprecation Removal
- [ ] Remove `ArticleResponse` (after 3 months)
- [ ] Remove `ArticleBase` (after 3 months)
- [ ] Update all remaining references
- [ ] Remove deprecated code

### Documentation Updates
- [ ] Update API documentation
- [ ] Update developer guides
- [ ] Update architecture diagrams
- [ ] Archive migration documents

---

## Quick Wins (Can Do Immediately)

### High Impact, Low Effort
- [ ] Update one list endpoint to use `UnifiedArticleListResponse`
- [ ] Measure payload size reduction
- [ ] Update one service method to use `model_validate()`
- [ ] Measure serialization speed improvement
- [ ] Add `defer(content)` to one list query
- [ ] Measure database query improvement

### Validation
- [ ] Run performance benchmark on staging
- [ ] Compare before/after metrics
- [ ] Document improvements
- [ ] Share results with team

---

## Rollback Plan

### If Issues Arise
- [ ] Revert API layer changes (use old response models)
- [ ] Revert service layer changes (use old transformers)
- [ ] Keep schema layer changes (backward compatible)
- [ ] Investigate issues
- [ ] Fix and redeploy

### Backward Compatibility
- [x] Old schemas still work (deprecated but functional)
- [x] No breaking changes in API
- [x] Gradual migration possible
- [x] Can rollback individual layers

---

## Success Criteria

### Performance Metrics
- [ ] 80% reduction in list endpoint payload size
- [ ] 50% faster serialization time
- [ ] 90% faster metadata validation
- [ ] 30% reduction in CPU usage

### Quality Metrics
- [ ] Zero type-related runtime errors
- [ ] 100% test coverage for new schemas
- [ ] No increase in error rates
- [ ] No increase in response times

### Business Metrics
- [ ] Reduced bandwidth costs
- [ ] Faster page load times
- [ ] Improved user experience
- [ ] Positive developer feedback

---

## Resources

### Documentation
- `SCHEMA_MIGRATION_GUIDE.md` - Comprehensive guide
- `SCHEMA_QUICK_REFERENCE.md` - Quick reference
- `SCHEMA_CHANGES_SUMMARY.md` - Technical details
- `SCHEMA_ARCHITECTURE_DIAGRAM.md` - Visual diagrams
- `examples/schema_usage_examples.py` - Code examples

### Support
- Backend team for questions
- Code review for changes
- Performance team for benchmarks
- Frontend team for type generation

---

## Timeline Estimate

### Conservative Estimate
- Phase 1: ✅ Complete (1 week)
- Phase 2: 1-2 weeks (service layer)
- Phase 3: 1 week (API layer)
- Phase 4: 1 week (testing)
- Phase 5: 1-2 weeks (frontend)
- Phase 6: 1 week (deployment)
- Phase 7: Ongoing (cleanup)

**Total: 6-9 weeks**

### Aggressive Estimate
- Phase 1: ✅ Complete
- Phase 2-3: 1 week (backend)
- Phase 4: 3 days (testing)
- Phase 5: 1 week (frontend)
- Phase 6: 2 days (deployment)

**Total: 3-4 weeks**

---

## Notes

- All schema changes are backward compatible
- Old code continues to work during migration
- Can migrate one endpoint at a time
- Performance improvements are immediate
- Type safety improvements are immediate
- No database migrations required

---

**Last Updated**: 2024  
**Status**: Phase 1 Complete, Phase 2 Ready to Start  
**Owner**: Backend Team
