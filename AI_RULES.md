# AI Development Rules for GAMA FUT

This document outlines the core technologies and rules for AI-assisted development on the GAMA FUT project.

## Tech Stack

*   **Frontend Framework:** React (with TypeScript)
*   **State Management:** React Context API (for global state), Component-level state, and `useState`/`useMemo` hooks.
*   **Routing:** React Router DOM (for client-side navigation)
*   **Styling:** Tailwind CSS (for utility-first styling), Shadcn/ui components (for pre-built, accessible UI elements).
*   **Backend/Database:** Supabase (PostgreSQL database, Auth, Storage, Realtime)
*   **API Interaction:** Supabase JS Client Library
*   **Icons:** Lucide React
*   **Build Tool:** Vite

## Library Usage Rules

1.  **React & TypeScript:** All frontend code must be written in React using TypeScript. Components should be functional and utilize hooks.
2.  **Tailwind CSS:** Use Tailwind CSS for all styling. Leverage its utility classes extensively for layout, spacing, colors, and responsive design. Avoid custom CSS files unless absolutely necessary for complex animations or specific overrides not achievable with Tailwind.
3.  **Shadcn/ui:** Utilize Shadcn/ui components for standard UI elements (buttons, modals, inputs, cards, etc.). These components are pre-built, accessible, and styled with Tailwind. Do not modify Shadcn/ui components directly; create wrapper components if customization is needed.
4.  **Supabase:** All data fetching, mutations, and authentication must be handled via the Supabase JS client library. Direct SQL queries should only be used within the `sqlSchema.ts` file or when explicitly instructed for complex operations.
5.  **React Router:** Use React Router for all client-side navigation. Define routes in `App.tsx`.
6.  **Lucide React:** Use Lucide React for icons. Import them directly as needed.
7.  **State Management:**
    *   For local component state, use `useState` and `useReducer`.
    *   For derived state or memoized values, use `useMemo`.
    *   For global state shared across multiple components (like user authentication status), use React Context. Avoid prop drilling.
8.  **File Structure:** Maintain a clear project structure:
    *   `src/pages`: For top-level page components.
    *   `src/components`: For reusable UI components.
    *   `src/hooks`: For custom React hooks.
    *   `src/contexts`: For React Context providers.
    *   `src/lib` or `src/utils`: For utility functions and Supabase client setup.
    *   `src/types`: For all TypeScript interfaces and types.
9.  **Error Handling:** Implement robust error handling. Use `try...catch` blocks for operations that might fail (like API calls). Provide user feedback via toasts for errors and success messages. Do not suppress errors; let them bubble up if they cannot be handled gracefully.
10. **Code Quality:** Write clean, readable, and maintainable code. Follow established React and TypeScript best practices. Add comments where necessary to explain complex logic. Ensure all components are responsive.