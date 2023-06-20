import crypto from "crypto"
import axios from "axios"
import config from "config"

type WithingsAddress = {
  name: string
  company_name?: string
  email: string
  telephone?: string
  address1: string
  address2?: string
  city: string
  zip: string
  state?: string
  country: string
}

class WithingsService {
  private apiUrl: string
  private clientId: string
  private clientSecret: string

  constructor() {
    this.clientId = config.get("withings.apiUrl")
    this.clientId = config.get("withings.clientId")
    this.clientSecret = config.get("withings.clientSecret")
  }

  private parseErrors(response: any) {
    if (typeof response !== "object" || !("status" in response)) {
      throw new Error(
        `Withings API answered with unexcepted error : [${JSON.stringify(
          response
        )}]`
      )
    }
    if (response.status !== 0) {
      if ("error" in response) {
        throw new Error(
          `Withings API answered with status : [${response.status}] - Error: ${response.error}`
        )
      }
      throw new Error(
        `Withings API answered with status : [${
          response.status
        }] - Response: [${JSON.stringify(response)}]`
      )
    }
  }

  private sign({
    action,
    client_id,
    timestamp,
    nonce,
  }: {
    action: string
    client_id: string
    timestamp?: number
    nonce?: string
  }) {
    const paramsToSign: {
      action: string
      client_id: string
      timestamp?: number
      nonce?: string
    } = {
      action,
      client_id,
    }

    if (timestamp) {
      paramsToSign.timestamp = timestamp
    }

    if (timestamp) {
      paramsToSign.nonce = nonce
    }

    const sorted_values = Object.values(paramsToSign).join(",")
    const hmac = crypto.createHmac("sha256", this.clientSecret)
    hmac.update(sorted_values)
    return hmac.digest("hex")
  }

  private async getNonce(timestamp: number) {
    const params = {
      action: "getnonce",
      client_id: this.clientId,
      timestamp: timestamp, //timestamp should be in unix form
    }
    const signature = this.sign(params)
    const { data } = await axios.post(this.apiUrl + "/v2/signature", {
      ...params,
      signature,
    })
    this.parseErrors(data)
    return data.body.nonce
  }

  public async createOrder(address: WithingsAddress, testmode?: number) {
    const now = Math.round(Date.now() / 1000)
    const nonce = await this.getNonce(now)

    const products = [
      {
        ean: "3700546707100",
        quantity: 1,
      },
    ]

    const order = {
      customer_ref_id: "ref",
      address,
      products,
      force_address: true,
    }

    const params = {
      action: "createorder",
      client_id: this.clientId,
      nonce,
      testmode,
      order: JSON.stringify([order]), // order should always be passed a JSON array of Order objects
    }
    const signature = this.sign(params)
    const { data } = await axios.post(this.apiUrl + "/v2/dropshipment", {
      ...params,
      signature,
    })
    this.parseErrors(data)
    return data.body.orders
  }
}

export default WithingsService
