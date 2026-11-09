(function () {
    const identifyUserWithPosthog = async () => {
        if (typeof posthog === 'undefined' || !posthog) {
            return;
        }

        try {
            const response = await fetch('/api/check_access', {
                credentials: 'same-origin',
                headers: {
                    'Accept': 'application/json'
                }
            });

            if (!response.ok) {
                return;
            }

            const data = await response.json();

            if (!data || !data.access || !data.username) {
                return;
            }

            const personProperties = {
                username: data.username,
                tier: data.tier || 'Free',
                plan: data.tier || 'Free',
                has_access: true,
                person_display_name: data.username
            };

            if (data.email) {
                personProperties.email = data.email;
            }

            // Set has_visited_dashboard to true if user is currently on the dashboard page
            const currentPath = window.location.pathname;
            if (currentPath === '/dashboard' || currentPath === '/dashboard/') {
                personProperties.has_visited_dashboard = true;
            }

            // Add lecture summary counts
            if (data.lectures_count !== undefined) {
                personProperties.lectures_count = data.lectures_count;
            }

            if (data.lifetime_summaries_count !== undefined) {
                personProperties.lifetime_summaries_count = data.lifetime_summaries_count;
            }

            posthog.identify(data.username, personProperties);
        } catch (error) {
            if (window && window.console) {
                console.debug('PostHog identify skipped', error);
            }
        }
    };

    if (document.readyState === 'interactive' || document.readyState === 'complete') {
        identifyUserWithPosthog();
    } else {
        document.addEventListener('DOMContentLoaded', identifyUserWithPosthog);
    }
})();

