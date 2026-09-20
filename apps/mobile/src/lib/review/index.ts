import AsyncStorage from '@react-native-async-storage/async-storage';
import { Alert, AppState, Linking, Platform } from 'react-native';
import {
  applyReviewActivity,
  emptyReviewHistory,
  isReviewEligible,
  type ReviewHistory,
} from './eligibility';

const STORAGE_KEY = 'readspace-review-history';
// Temporary local testing switch. Remove this adapter once native review testing is available.
const USE_REVIEW_PROMPT_MOCK = __DEV__;
let queue: Promise<unknown> = Promise.resolve();
let pendingReturn = false;

const reviewMock = {
  async isAvailableAsync() {
    return true;
  },
  async requestReview() {
    Alert.alert(
      'Review prompt (mock)',
      'This is where the native App Store / Google Play review prompt will appear.',
      [{ text: 'Close', style: 'cancel' }]
    );
  },
};

async function getReviewApi() {
  if (USE_REVIEW_PROMPT_MOCK) return reviewMock;
  const StoreReview = await import('expo-store-review');
  return StoreReview;
}

// Serialize reads and writes so navigation and foreground events cannot lose updates.
function updateHistory(update: (history: ReviewHistory) => void | Promise<void>) {
  queue = queue
    .then(async () => {
      const saved = await AsyncStorage.getItem(STORAGE_KEY);
      const history: ReviewHistory = saved
        ? JSON.parse(saved)
        : { ...emptyReviewHistory, days: [], articleIds: [] };
      await update(history);
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(history));
    })
    .catch((error) => console.warn('Review tracking failed:', error));
  return queue;
}

export function recordReviewActivity(articleId?: string, digest = false) {
  if (AppState.currentState !== 'active') return;
  if (articleId || digest) pendingReturn = true;
  return updateHistory((history) => {
    Object.assign(history, applyReviewActivity(history, new Date(), articleId, digest));
  });
}

export function requestReviewAfterReading(isSafe: () => boolean) {
  if (!pendingReturn) return;
  pendingReturn = false;
  return updateHistory(async (history) => {
    if (!isReviewEligible(history, Date.now()) || !isSafe()) return;
    const review = await getReviewApi();
    if (!(await review.isAvailableAsync()) || !isSafe()) return;
    // Record attempts, not completed reviews: neither store reports whether the user reviewed.
    history.lastRequestedAt = Date.now();
    history.articlesAtLastRequest = history.articleIds.length;
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(history));
    if (isSafe()) await review.requestReview();
  });
}

export async function openStoreReview() {
  const url =
    Platform.OS === 'ios'
      ? 'https://apps.apple.com/app/id6790224641?action=write-review'
      : 'https://play.google.com/store/apps/details?id=com.readspace.rss';
  await Linking.openURL(url);
  await updateHistory((history) => {
    history.lastRequestedAt = Date.now();
    history.articlesAtLastRequest = history.articleIds.length;
  });
}
