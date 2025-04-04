import { routePartykitRequest, Server } from "partyserver";

import type { OutgoingMessage, Position } from "../shared";
import type { Connection, ConnectionContext } from "partyserver"; // Corrected import
import type { DurableObjectNamespace } from "@cloudflare/workers-types"; // Import DO Namespace

// Define the Env interface with the correct DO Namespace type and EmailJS vars
interface Env {
  Globe: DurableObjectNamespace;
  EMAILJS_SERVICE_ID: string;
  EMAILJS_TEMPLATE_ID: string;
  EMAILJS_PUBLIC_KEY: string;
  // Add other environment variables if needed
}

// This is the state that we'll store on each connection
type ConnectionState = {
  position: Position;
};

export class Globe extends Server<ConnectionState> {
  // ConnectionContext is not generic in partyserver types
  onConnect(conn: Connection<ConnectionState>, ctx: ConnectionContext) {
    // Whenever a fresh connection is made, we'll
    // send the entire state to the new connection

    // First, let's extract the position from the Cloudflare headers
    const latitude = ctx.request.cf?.latitude as string | undefined;
    const longitude = ctx.request.cf?.longitude as string | undefined;
    const city = ctx.request.cf?.city as string | undefined;
    const country = ctx.request.cf?.country as string | undefined;
    if (!latitude || !longitude) {
      console.warn(`Missing position information for connection ${conn.id}`);
      return;
    }
    const position = {
      lat: parseFloat(latitude),
      lng: parseFloat(longitude),
      id: conn.id,
      city,
      country,
    };
    // And save this on the connection's state
    conn.setState({
      position,
    });

    // Now, let's send the entire state to the new connection
    for (const connection of this.getConnections<ConnectionState>()) {
      // Check if connection state exists before accessing position
      if (connection.state?.position) {
        try {
          conn.send(
            JSON.stringify({
              type: "add-marker",
              position: connection.state.position,
            } satisfies OutgoingMessage),
          );

          // And let's send the new connection's position to all other connections
          if (connection.id !== conn.id) {
            connection.send(
              JSON.stringify({
                type: "add-marker",
                position, // Send the new connection's position
              } satisfies OutgoingMessage),
            );
          }
        } catch (e) {
           console.error(`Failed to send message to ${connection.id}:`, e);
           // Optionally close the connection if sending fails repeatedly
           // this.onCloseOrError(connection); // Be careful not to cause infinite loops
        }
      } else {
         console.warn(`Connection ${connection.id} missing state or position.`);
      }
    }
  }

  // Whenever a connection closes (or errors), we'll broadcast a message to all
  // other connections to remove the marker.
  onCloseOrError(connection: Connection) {
    this.broadcast(
      JSON.stringify({
        type: "remove-marker",
        id: connection.id,
      } satisfies OutgoingMessage),
      [connection.id], // Exclude the closing connection
    );
  }

  onClose(connection: Connection): void | Promise<void> {
    console.log(`Connection ${connection.id} closed`);
    this.onCloseOrError(connection);
  }

  onError(connection: Connection, error: Error): void | Promise<void> {
    console.error(`Connection ${connection.id} errored:`, error);
    this.onCloseOrError(connection);
  }
}

// Single default export for the Worker
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    // --- CORS Headers Helper ---
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*", // Be more specific in production!
      "Access-Control-Allow-Methods": "GET, HEAD, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    };

    // Handle CORS preflight requests
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    // --- API Endpoints ---

    // Endpoint to provide client-side configuration (including EmailJS Public Key)
    if (url.pathname === "/api/config") {
      const config = {
        emailJsPublicKey: env.EMAILJS_PUBLIC_KEY,
        emailJsServiceId: env.EMAILJS_SERVICE_ID,
        emailJsTemplateId: env.EMAILJS_TEMPLATE_ID,
        // Add other config variables if needed
      };
      return new Response(JSON.stringify(config), {
        headers: {
          "Content-Type": "application/json",
          ...corsHeaders, // Include CORS headers
        },
      });
    }

    // Endpoint for user location based on CF headers
    if (url.pathname === "/api/location") {
      const city = request.cf?.city as string | undefined;
      const region = request.cf?.region as string | undefined; // region often corresponds to state/province

      const locationData = {
        city: city || "Unknown",
        state: region || "Location", // Use region for state, provide fallback
      };

      return new Response(JSON.stringify(locationData), {
        headers: {
          "Content-Type": "application/json",
          ...corsHeaders, // Include CORS headers
        },
      });
    }

    // Otherwise, try routing to PartyKit Durable Object
    // Pass an object containing the specific DO binding
    const partykitResponse = await routePartykitRequest(request, { Globe: env.Globe });

    // If PartyKit handled the request, return its response
    if (partykitResponse) {
      return partykitResponse;
    }

    // If PartyKit didn't handle it (e.g., it's not a WebSocket upgrade or specific PartyKit path),
    // return a 404. Cloudflare's platform will handle serving static assets
    // from the 'public' directory based on wrangler.json *before* this worker fetch runs
    // for matching paths (except potentially '/'). Headers for those assets
    // should be managed via a _headers file.
    return new Response("Not Found", { status: 404 });
  }
};
