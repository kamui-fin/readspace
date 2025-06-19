<div align="center">
  <img src="./web/public/readspace.svg" alt="Readspace Logo" width="100" />
</div>


# Readspace

**Tired of digital noise? Readspace brings all your content into one clean, distraction-free inbox.**

**RSS. Newsletters. Twitter. Reddit. Articles. Books.**
All in one beautiful, modern UI, designed for focused reading.

![](./web/public/demo.png)

---

## What is Readspace?

Readspace is an **open-source, privacy-focused platform** that streamlines your digital reading. It's your personal, curated inbox for everything you want to read from across the web—**without ads, algorithms, or distractions.**

Inspired by Google Reader's simplicity, Readspace modernizes RSS for today’s readers.

> [!NOTE]
> RSS empowers you to directly follow your favorite websites and creators, keeping your feed clean, chronological, and free from manipulative algorithms. Think of it as a quieter, more personal social feed, where *you* control what you see.

## Why You'll Love Readspace

* **Beautiful UI/UX:** Intuitive, minimalistic, and crafted for enjoyable, focused reading.
* **Privacy & Control:** Zero ads, no analytics, fully self-hostable. Your data remains yours.
* **Smart AI (Optional & Local):** Local summarization, noise filtering, auto-tagging, and personalized content discovery—all privacy-preserving.

## Why Choose Readspace Over Feedly or Readwise?

* **Feedly** has pivoted to enterprise threat detection, offers a severely limited free tier, and suffers from declining reliability.
* **Readwise Reader** is not really geared towards RSS, still in beta after years, proprietary and paywalled.

**Readspace** offers a superior, transparent, and open-source alternative. We're built by readers, for readers, with a singular focus on an exceptional reading experience.

## Built for Focused Reading

* **Comprehensive Content:** Seamlessly integrate RSS feeds, newsletters, saved articles, books, Twitter threads, and Reddit posts.
* **Chrome Extension:** Quickly save articles and capture content directly from your browser.
* **Enhanced Reading:** Enjoy EPUB/PDF reading, with robust annotation and highlighting tools.
* **Cross-Platform:** Mobile apps built with React Native are in development.

## Readspace is Perfect If You:

* Are overwhelmed by endless tabs, bookmarks, and unread newsletters.
* Want to effortlessly stay informed about your interests and current events.
* Deeply value your privacy, open-source software, and full control over your data.


## Getting Started

### Prerequisites

* **Git**: For cloning the repository.
* **Docker**: Ensure Docker Desktop or Docker Engine is installed and running (v20 or higher recommended).

### Self-Hosting

Readspace is designed for easy self-hosting, giving you complete control over your data and experience.


1.  **Clone the Repository**

    Start by cloning the Readspace repository to your local machine:

    ```bash
    git clone https://github.com/kamui-fin/readspace.git
    cd readspace
    ```

2.  **Set Up and Start Supabase Backend**

    This step will prepare and launch your local Supabase services, which Readspace relies on for its backend database and authentication.

    ```bash
    # Navigate to the Supabase directory
    cd supabase

    # Generate necessary environment secrets for Supabase
    ./gensecrets.sh

    # Launch Supabase services using its specific docker-compose file
    # This will bring up services like PostgreSQL, Auth, Storage, etc.
    docker compose -f docker-compose.yml --env-file ./.env up -d

    # Go back to the root directory
    cd ..
    ```

> [!NOTE]
> Use [this](https://supabase.com/docs/guides/self-hosting/docker#generate-api-keys) to generate the **ANON_KEY** and **SERVICE_ROLE_KEY** from a **JWT_SECRET**

4.  **Launch Readspace Application**

    From the root of the `readspace` directory, use Docker Compose to bring up the main Readspace application services. This will connect to your local Supabase backend.

    ```bash
    docker compose --env-file supabase/.env up -d
    ```
5.  **Access Your Instance**

    Once all services are running, your Readspace instance should be accessible in your web browser.

    Visit `localhost:8042`

## Community & Roadmap

We're building Readspace transparently and collaboratively. Join our growing community and help shape the future of focused reading:

* **Discord:** [Join our community here](https://discord.gg/2Q5PtYwUQZ)
* **GitHub:** Star us and help shape the product.

Readspace is open-source, built by readers, for readers. We believe you'll feel the difference.