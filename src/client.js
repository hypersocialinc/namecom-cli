// Thin client for the Name.com v4 REST API.
// Knows nothing about the CLI — just HTTP + auth + endpoints. Keeping this
// layer separate is what makes a future second provider a cheap extraction.

const DEFAULT_BASE = "https://api.name.com";

export class NameClient {
  constructor({ user, token, baseUrl }) {
    if (!user || !token) {
      throw new Error("Missing Name.com credentials (user and token required).");
    }
    this.user = user;
    this.baseUrl = (baseUrl || process.env.NAMECOM_API_URL || DEFAULT_BASE).replace(/\/+$/, "");
    this.auth = "Basic " + Buffer.from(`${user}:${token}`).toString("base64");
  }

  async req(method, path, body) {
    const res = await fetch(`${this.baseUrl}/v4${path}`, {
      method,
      headers: {
        Authorization: this.auth,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    const text = await res.text();
    let data;
    try {
      data = text ? JSON.parse(text) : {};
    } catch {
      data = { raw: text };
    }

    if (!res.ok) {
      const detail = data?.details || data?.message || res.statusText;
      const err = new Error(`Name.com API ${res.status}: ${detail}`);
      err.status = res.status;
      err.data = data;
      throw err;
    }
    return data;
  }

  // Domains
  listDomains() {
    return this.req("GET", "/domains").then((d) => d.domains || []);
  }

  // Records
  listRecords(domain) {
    return this.req("GET", `/domains/${domain}/records`).then((d) => d.records || []);
  }
  getRecord(domain, id) {
    return this.req("GET", `/domains/${domain}/records/${id}`);
  }
  createRecord(domain, body) {
    return this.req("POST", `/domains/${domain}/records`, body);
  }
  updateRecord(domain, id, body) {
    return this.req("PUT", `/domains/${domain}/records/${id}`, body);
  }
  deleteRecord(domain, id) {
    return this.req("DELETE", `/domains/${domain}/records/${id}`);
  }
}
