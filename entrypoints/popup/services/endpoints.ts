export const IG_APP_ID = "936619743392459";
export const IG_BASE_URL = "https://www.instagram.com";

export enum IgEndpoint {
  FOLLOWING = "/api/v1/friendships/{userId}/following/",
  FOLLOWERS = "/api/v1/friendships/{userId}/followers/",
  FRIENDSHIP_SHOW = "/api/v1/friendships/show/{userId}/",
  USER_INFO = "/api/v1/users/{userId}/info/",
  CURRENT_USER = "/api/v1/accounts/current_user/?edit=true",
}

export function buildEndpointUrl(
  endpoint: IgEndpoint,
  userId: string,
  count?: number,
  maxId?: string | null
): string {
  const path = endpoint.replace("{userId}", encodeURIComponent(userId));
  const url = new URL(`${IG_BASE_URL}${path}`);
  if (count !== undefined) {
    url.searchParams.set("count", String(count));
  }
  if (maxId) {
    url.searchParams.set("max_id", maxId);
  }
  return url.toString();
}

export function getIgHeaders(csrfToken: string = ""): Record<string, string> {
  return {
    "x-ig-app-id": IG_APP_ID,
    "x-csrftoken": csrfToken,
    "x-requested-with": "XMLHttpRequest",
    accept: "*/*",
    referer: `${IG_BASE_URL}/`,
  };
}
