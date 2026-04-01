import axios from "axios";

export const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL ?? "/",
  withCredentials: true,
});

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error?.response?.status === 401) {
      try {
        await axios.post("/api/auth/refresh", {}, { withCredentials: true });
        return api.request(error.config);
      } catch {
        return Promise.reject(error);
      }
    }
    return Promise.reject(error);
  },
);
