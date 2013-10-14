
// callforth("error") -- throw
// callforth(null) -- attempt()
// callforth.tell() -- send()

// Special case: throws will be thrown in inner-attempt-tries.
// (inner-attempts' catches and finales will execute throughout the try-line)



function attempt () {
	try {

		(function () {
			
			// do work ... send(), send(), send()
			function send() {

				try {

					(function () {
						
						// do work ... send(), send(), send()
						function send() {

							try {

								(function () {
									
									// do work ... send(), send(), send()
									// throw || attempt()

									function attempt () {
									}
								}) ();

							} catch (f) {

							} finally {

							}
						}
						// throw || attempt()

						function attempt () {
						}
					}) ();

				} catch (f) {

				} finally {

				}
			}
			// throw || attempt()

			function attempt () {
				try {

					(function () {
						
						// do work ... send(), send(), send()
						// throw || attempt()

						function attempt () {
							try {

							} catch (f) {

							} finally {

							}
						}
					}) ();

				} catch (f) {

					try {
						(function () {
							
							// do work ... send(), send(), send()
							// throw || attempt()

							function attempt () {
								try {

								} catch (f) {

								} finally {

								}
							}
						}) ();
					} catch (e) {

					} finally {
						
					}
					
				} finally {

					try {
						(function () {
							
							// do work ... send(), send(), send()
							// throw || attempt()

							function attempt () {
								try {

								} catch (f) {

								} finally {

								}
							}
						}) ();
					} catch (e) {

					} finally {
						
					}
					
				}
			}
		}) ();

	} catch (e) {

		try {
			(function () {
				
				// do work ... send(), send(), send()
				// throw || attempt()

				function attempt () {
					try {

					} catch (f) {

					} finally {

					}
				}
			}) ();
		} catch (e) {

		} finally {
			
		}
		
	} finally {

		try {
			(function () {
				
				// do work ... send(), send(), send()
				// throw || attempt()

				function attempt () {
					try {

					} catch (f) {

					} finally {

					}
				}
			}) ();
		} catch (e) {

		} finally {
			
		}
		
	}
}
