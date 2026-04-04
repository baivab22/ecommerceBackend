
const HolidayMode = require('../modals/holidayModal.modal');

function startHolidayModeSchedulers() {
	console.log('Holiday mode schedulers started (every 2 minutes)');
	setInterval(async () => {
		try {
			const settings = await HolidayMode.getSettings();
			const now = new Date();
			let shouldBeActive = false;
			if (settings.startDate && settings.endDate) {
				shouldBeActive = now >= new Date(settings.startDate) && now < new Date(settings.endDate);
			} else if (settings.startDate && !settings.endDate) {
				shouldBeActive = now >= new Date(settings.startDate);
			} else if (!settings.startDate && settings.endDate) {
				shouldBeActive = now < new Date(settings.endDate);
			}
			if (settings.isActive !== shouldBeActive) {
				settings.isActive = shouldBeActive;
				await settings.save();
				console.log(`[HolidayMode] isActive auto-updated to: ${shouldBeActive} at ${now.toISOString()}`);
			}
		} catch (err) {
			console.error('[HolidayMode Scheduler] Error:', err);
		}
	}, 2 * 60 * 1000); // every 2 minutes
}

module.exports = { startHolidayModeSchedulers };
