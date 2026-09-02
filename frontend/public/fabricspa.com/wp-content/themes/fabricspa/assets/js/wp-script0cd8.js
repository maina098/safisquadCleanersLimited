const homeBannerSlider = new Swiper('.home-banner-swiper', {
    autoplay: {
        delay: 5000,
        disableOnInteraction: false,
    },
    loop: true,
    effect: "fade",
    navigation: {
        prevEl: ".home-slider-prev",
        nextEl: ".home-slider-next",
    },
    breakpoints: {
    768: { autoHeight: false }, // enable adaptive height for tablets & up
    320: { autoHeight: true }, // also for mobile
  },
})

const homeStepsSlider = new Swiper('.home-steps-slider', {
    slidesPerView: 1,
    spaceBetween: 30,
    autoplay: {
        delay: 2000,
    },
    breakpoints: {
        576: {
            slidesPerView: 1.5,
        },
        768: {
            slidesPerView: 2,
        },
        992: {
            slidesPerView: 2.5,
        },
        1200: {
            slidesPerView: 3,
        },
    },
    pagination: {
        enabled: true,
        el: '.home-step-pagination',
        clickable: true,
    }
})

const homeTestimonialSlider = new Swiper('.home-testimonials-slider', {
    slidesPerView: 1,
    spaceBetween: 30,
    autoplay: {
        delay: 5000,
    },
    breakpoints: {
        576: {
            slidesPerView: 1.5,
        },
        768: {
            slidesPerView: 2,
        },
        992: {
            slidesPerView: 2.5,
        },
        1200: {
            slidesPerView: 3,
        },
    },
    pagination: {
        enabled: true,
        el: '.home-testimonials-pagination',
        clickable: true,
    }
})

// const homeServiceSlider = new Swiper(".home-service-slider", {
//     slidesPerView: 2.5,
//     centeredSlides: true,
//     loop: true,
//     centeredSlides: true,
//     autoplay: {
//         delay: 3000,
//     },
//     effect: 'coverflow',
//     coverflowEffect: {
//         rotate: 0,
//         stretch: 30,
//         depth: 90,
//         modifier: 1.5,
//         slideShadows: false,
//     },
//     breakpoints: {
//         1200: {
//             slidesPerView: 3.9,
//             coverflowEffect: {
//                 rotate: 0,
//                 stretch: 50,
//                 depth: 90,
//                 modifier: 2,
//                 slideShadows: false,
//             },
//         }
//     },
//     scrollbar: {
//         el: '.home-service-scrollbar',
//         draggable: true,
//     },
//     on: {
//         slideChange: (e) => {
//             const activeIndex = e?.realIndex;
//             document.querySelectorAll(".service-title")?.forEach(el => el.classList.add("opacity-0"))
//             document.querySelectorAll(".service-title")?.[activeIndex]?.classList?.remove("opacity-0");
//         },
//         init: (e) => {
//             const activeIndex = e?.realIndex;
//             document.querySelectorAll(".service-title")?.forEach(el => el.classList.add("opacity-0"))
//             document.querySelectorAll(".service-title")?.[activeIndex]?.classList?.remove("opacity-0");
//         }
//     }
// });

const homeWorksSlider = new Swiper('.home-work-slider', {
    autoplay: {
        delay: 5000
    },
    pagination: {
        enabled: true,
        el: '.home-work-pagination',
        clickable: true,
    }
});


 document.addEventListener( 'wpcf7mailsent', function( event ) {
    // Replace with your thank-you page URL
    window.location.href = "https://fabricspa.com/thank-you/";
}, false );
 

(function ($) {
    "use strict";
    
    let homeServiceSlider; // Store Swiper instance globally

    function initHomeServiceSlider() {
        homeServiceSlider = new Swiper(".home-service-slider", {
            slidesPerView: 2.5,
            centeredSlides: true,
            loop: true,
            autoplay: {
                delay: 3000,
            },
            effect: 'coverflow',
            coverflowEffect: {
                rotate: 0,
                stretch: 30,
                depth: 90,
                modifier: 1.5,
                slideShadows: false,
            },
            breakpoints: {
                1200: {
                    slidesPerView: 3.9,
                    coverflowEffect: {
                        rotate: 0,
                        stretch: 50,
                        depth: 90,
                        modifier: 2,
                        slideShadows: false,
                    },
                }
            },
            scrollbar: {
                el: '.home-service-scrollbar',
                draggable: true,
            },
            on: {
                slideChange: (e) => {
                    const activeIndex = e?.realIndex;
                    document.querySelectorAll(".service-title")?.forEach(el => el.classList.add("opacity-0"));
                    document.querySelectorAll(".service-title")?.[activeIndex]?.classList?.remove("opacity-0");
                },
                init: (e) => {
                    const activeIndex = e?.realIndex;
                    document.querySelectorAll(".service-title")?.forEach(el => el.classList.add("opacity-0"));
                    document.querySelectorAll(".service-title")?.[activeIndex]?.classList?.remove("opacity-0");
                }
            }
        });
    }

    document.addEventListener('DOMContentLoaded', function () {
        initHomeServiceSlider();
    });


    jQuery(document).ready(function ($) {
        $('button.service-btn').on('click', function () {
            var thiss = $(this);
					console.log(thiss);
			thiss[0].scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
            let serviceName = $(this).text();
            var pageid = $(this).closest('ul').attr('data-pageid');
            $.ajax({
                url: my_ajax_obj.ajax_url,
                type: 'POST',
                data: {
                    action: 'load_service_data',
                    pageid: pageid,
                    service_name: serviceName
                },
                success: function (response) {
                    if (homeServiceSlider) {
                        homeServiceSlider.destroy(true, true); // destroy previous instance
                    }
                    $('.service-btn').removeClass('active');
                    $(thiss).addClass('active');
                    $('.imageHtml').html(response.data.imageHtml);
                    $('.TitleHtml').html(response.data.TitleHtml);
                    
                    initHomeServiceSlider(); // reinitialize after DOM update

                     
                },
                error: function (xhr, status, error) {
                    console.error("AJAX Error:", error);
                }
            });
        });
    });



    function loadStores(page = 1, city = 'All') {
        $.ajax({
            url: my_ajax_obj.ajax_url,
            method: 'POST',
            data: {
                action: 'filter_stores',
                city: city,
                page: page
            },
            beforeSend: function() {
                $('#store-listing').html('<div class="w-full lg:mt-4 lg:px-4 lg:w-1/3 mt-6 px-2 sm:w-1/2 xl:w-1/4"><div class="w-full bg-white duration-300 flex flex-col group h-full hover:shadow-[0px_0px_10px_1px_#00000026] lg:p-[30px] p-5 rounded-[20px] transition-all"><div class="shimmer h-3 mb-5 w-[60%]"></div><div class="shimmer mb-6 h-5 w-[75%]"></div><div class=mb-6><div class="shimmer h-3 w-full mb-2"></div><div class="shimmer h-3 w-full mb-3"></div><div class="shimmer h-3 w-[70%]"></div></div><div class="shimmer h-3 mb-6 w-[80%]"></div><div class="shimmer h-3 w-[70%]"></div><div class="mt-auto pt-6"><div class="shimmer w-[60%] h-4"></div></div></div></div><div class="w-full lg:mt-4 lg:px-4 lg:w-1/3 mt-6 px-2 sm:w-1/2 xl:w-1/4"><div class="w-full bg-white duration-300 flex flex-col group h-full hover:shadow-[0px_0px_10px_1px_#00000026] lg:p-[30px] p-5 rounded-[20px] transition-all"><div class="shimmer h-3 mb-5 w-[60%]"></div><div class="shimmer mb-6 h-5 w-[75%]"></div><div class=mb-6><div class="shimmer h-3 w-full mb-2"></div><div class="shimmer h-3 w-full mb-3"></div><div class="shimmer h-3 w-[70%]"></div></div><div class="shimmer h-3 mb-6 w-[80%]"></div><div class="shimmer h-3 w-[70%]"></div><div class="mt-auto pt-6"><div class="shimmer w-[60%] h-4"></div></div></div></div><div class="w-full lg:mt-4 lg:px-4 lg:w-1/3 mt-6 px-2 sm:w-1/2 xl:w-1/4"><div class="w-full bg-white duration-300 flex flex-col group h-full hover:shadow-[0px_0px_10px_1px_#00000026] lg:p-[30px] p-5 rounded-[20px] transition-all"><div class="shimmer h-3 mb-5 w-[60%]"></div><div class="shimmer mb-6 h-5 w-[75%]"></div><div class=mb-6><div class="shimmer h-3 w-full mb-2"></div><div class="shimmer h-3 w-full mb-3"></div><div class="shimmer h-3 w-[70%]"></div></div><div class="shimmer h-3 mb-6 w-[80%]"></div><div class="shimmer h-3 w-[70%]"></div><div class="mt-auto pt-6"><div class="shimmer w-[60%] h-4"></div></div></div></div><div class="w-full lg:mt-4 lg:px-4 lg:w-1/3 mt-6 px-2 sm:w-1/2 xl:w-1/4"><div class="w-full bg-white duration-300 flex flex-col group h-full hover:shadow-[0px_0px_10px_1px_#00000026] lg:p-[30px] p-5 rounded-[20px] transition-all"><div class="shimmer h-3 mb-5 w-[60%]"></div><div class="shimmer mb-6 h-5 w-[75%]"></div><div class=mb-6><div class="shimmer h-3 w-full mb-2"></div><div class="shimmer h-3 w-full mb-3"></div><div class="shimmer h-3 w-[70%]"></div></div><div class="shimmer h-3 mb-6 w-[80%]"></div><div class="shimmer h-3 w-[70%]"></div><div class="mt-auto pt-6"><div class="shimmer w-[60%] h-4"></div></div></div></div><div class="w-full lg:mt-4 lg:px-4 lg:w-1/3 mt-6 px-2 sm:w-1/2 xl:w-1/4"><div class="w-full bg-white duration-300 flex flex-col group h-full hover:shadow-[0px_0px_10px_1px_#00000026] lg:p-[30px] p-5 rounded-[20px] transition-all"><div class="shimmer h-3 mb-5 w-[60%]"></div><div class="shimmer mb-6 h-5 w-[75%]"></div><div class=mb-6><div class="shimmer h-3 w-full mb-2"></div><div class="shimmer h-3 w-full mb-3"></div><div class="shimmer h-3 w-[70%]"></div></div><div class="shimmer h-3 mb-6 w-[80%]"></div><div class="shimmer h-3 w-[70%]"></div><div class="mt-auto pt-6"><div class="shimmer w-[60%] h-4"></div></div></div></div><div class="w-full lg:mt-4 lg:px-4 lg:w-1/3 mt-6 px-2 sm:w-1/2 xl:w-1/4"><div class="w-full bg-white duration-300 flex flex-col group h-full hover:shadow-[0px_0px_10px_1px_#00000026] lg:p-[30px] p-5 rounded-[20px] transition-all"><div class="shimmer h-3 mb-5 w-[60%]"></div><div class="shimmer mb-6 h-5 w-[75%]"></div><div class=mb-6><div class="shimmer h-3 w-full mb-2"></div><div class="shimmer h-3 w-full mb-3"></div><div class="shimmer h-3 w-[70%]"></div></div><div class="shimmer h-3 mb-6 w-[80%]"></div><div class="shimmer h-3 w-[70%]"></div><div class="mt-auto pt-6"><div class="shimmer w-[60%] h-4"></div></div></div></div><div class="w-full lg:mt-4 lg:px-4 lg:w-1/3 mt-6 px-2 sm:w-1/2 xl:w-1/4"><div class="w-full bg-white duration-300 flex flex-col group h-full hover:shadow-[0px_0px_10px_1px_#00000026] lg:p-[30px] p-5 rounded-[20px] transition-all"><div class="shimmer h-3 mb-5 w-[60%]"></div><div class="shimmer mb-6 h-5 w-[75%]"></div><div class=mb-6><div class="shimmer h-3 w-full mb-2"></div><div class="shimmer h-3 w-full mb-3"></div><div class="shimmer h-3 w-[70%]"></div></div><div class="shimmer h-3 mb-6 w-[80%]"></div><div class="shimmer h-3 w-[70%]"></div><div class="mt-auto pt-6"><div class="shimmer w-[60%] h-4"></div></div></div></div><div class="w-full lg:mt-4 lg:px-4 lg:w-1/3 mt-6 px-2 sm:w-1/2 xl:w-1/4"><div class="w-full bg-white duration-300 flex flex-col group h-full hover:shadow-[0px_0px_10px_1px_#00000026] lg:p-[30px] p-5 rounded-[20px] transition-all"><div class="shimmer h-3 mb-5 w-[60%]"></div><div class="shimmer mb-6 h-5 w-[75%]"></div><div class=mb-6><div class="shimmer h-3 w-full mb-2"></div><div class="shimmer h-3 w-full mb-3"></div><div class="shimmer h-3 w-[70%]"></div></div><div class="shimmer h-3 mb-6 w-[80%]"></div><div class="shimmer h-3 w-[70%]"></div><div class="mt-auto pt-6"><div class="shimmer w-[60%] h-4"></div></div></div></div>');
            },
            success: function(response) {
//                 console.log(response);
                $('#store-listing').html(response.data.html);
                $('#store-pagination').html(response.data.pagination);
            }
        });
    }
 
 
  function loadStoresBYname(page = 1, name , city) {
        $.ajax({
            url: my_ajax_obj.ajax_url,
            method: 'POST',
            data: {
                action: 'filter_stores_byname',
                name: name,
				city: city,
                page: page
            },
            beforeSend: function() {
                $('#store-listing').html('<div class="w-full lg:mt-4 lg:px-4 lg:w-1/3 mt-6 px-2 sm:w-1/2 xl:w-1/4"><div class="w-full bg-white duration-300 flex flex-col group h-full hover:shadow-[0px_0px_10px_1px_#00000026] lg:p-[30px] p-5 rounded-[20px] transition-all"><div class="shimmer h-3 mb-5 w-[60%]"></div><div class="shimmer mb-6 h-5 w-[75%]"></div><div class=mb-6><div class="shimmer h-3 w-full mb-2"></div><div class="shimmer h-3 w-full mb-3"></div><div class="shimmer h-3 w-[70%]"></div></div><div class="shimmer h-3 mb-6 w-[80%]"></div><div class="shimmer h-3 w-[70%]"></div><div class="mt-auto pt-6"><div class="shimmer w-[60%] h-4"></div></div></div></div><div class="w-full lg:mt-4 lg:px-4 lg:w-1/3 mt-6 px-2 sm:w-1/2 xl:w-1/4"><div class="w-full bg-white duration-300 flex flex-col group h-full hover:shadow-[0px_0px_10px_1px_#00000026] lg:p-[30px] p-5 rounded-[20px] transition-all"><div class="shimmer h-3 mb-5 w-[60%]"></div><div class="shimmer mb-6 h-5 w-[75%]"></div><div class=mb-6><div class="shimmer h-3 w-full mb-2"></div><div class="shimmer h-3 w-full mb-3"></div><div class="shimmer h-3 w-[70%]"></div></div><div class="shimmer h-3 mb-6 w-[80%]"></div><div class="shimmer h-3 w-[70%]"></div><div class="mt-auto pt-6"><div class="shimmer w-[60%] h-4"></div></div></div></div><div class="w-full lg:mt-4 lg:px-4 lg:w-1/3 mt-6 px-2 sm:w-1/2 xl:w-1/4"><div class="w-full bg-white duration-300 flex flex-col group h-full hover:shadow-[0px_0px_10px_1px_#00000026] lg:p-[30px] p-5 rounded-[20px] transition-all"><div class="shimmer h-3 mb-5 w-[60%]"></div><div class="shimmer mb-6 h-5 w-[75%]"></div><div class=mb-6><div class="shimmer h-3 w-full mb-2"></div><div class="shimmer h-3 w-full mb-3"></div><div class="shimmer h-3 w-[70%]"></div></div><div class="shimmer h-3 mb-6 w-[80%]"></div><div class="shimmer h-3 w-[70%]"></div><div class="mt-auto pt-6"><div class="shimmer w-[60%] h-4"></div></div></div></div><div class="w-full lg:mt-4 lg:px-4 lg:w-1/3 mt-6 px-2 sm:w-1/2 xl:w-1/4"><div class="w-full bg-white duration-300 flex flex-col group h-full hover:shadow-[0px_0px_10px_1px_#00000026] lg:p-[30px] p-5 rounded-[20px] transition-all"><div class="shimmer h-3 mb-5 w-[60%]"></div><div class="shimmer mb-6 h-5 w-[75%]"></div><div class=mb-6><div class="shimmer h-3 w-full mb-2"></div><div class="shimmer h-3 w-full mb-3"></div><div class="shimmer h-3 w-[70%]"></div></div><div class="shimmer h-3 mb-6 w-[80%]"></div><div class="shimmer h-3 w-[70%]"></div><div class="mt-auto pt-6"><div class="shimmer w-[60%] h-4"></div></div></div></div><div class="w-full lg:mt-4 lg:px-4 lg:w-1/3 mt-6 px-2 sm:w-1/2 xl:w-1/4"><div class="w-full bg-white duration-300 flex flex-col group h-full hover:shadow-[0px_0px_10px_1px_#00000026] lg:p-[30px] p-5 rounded-[20px] transition-all"><div class="shimmer h-3 mb-5 w-[60%]"></div><div class="shimmer mb-6 h-5 w-[75%]"></div><div class=mb-6><div class="shimmer h-3 w-full mb-2"></div><div class="shimmer h-3 w-full mb-3"></div><div class="shimmer h-3 w-[70%]"></div></div><div class="shimmer h-3 mb-6 w-[80%]"></div><div class="shimmer h-3 w-[70%]"></div><div class="mt-auto pt-6"><div class="shimmer w-[60%] h-4"></div></div></div></div><div class="w-full lg:mt-4 lg:px-4 lg:w-1/3 mt-6 px-2 sm:w-1/2 xl:w-1/4"><div class="w-full bg-white duration-300 flex flex-col group h-full hover:shadow-[0px_0px_10px_1px_#00000026] lg:p-[30px] p-5 rounded-[20px] transition-all"><div class="shimmer h-3 mb-5 w-[60%]"></div><div class="shimmer mb-6 h-5 w-[75%]"></div><div class=mb-6><div class="shimmer h-3 w-full mb-2"></div><div class="shimmer h-3 w-full mb-3"></div><div class="shimmer h-3 w-[70%]"></div></div><div class="shimmer h-3 mb-6 w-[80%]"></div><div class="shimmer h-3 w-[70%]"></div><div class="mt-auto pt-6"><div class="shimmer w-[60%] h-4"></div></div></div></div><div class="w-full lg:mt-4 lg:px-4 lg:w-1/3 mt-6 px-2 sm:w-1/2 xl:w-1/4"><div class="w-full bg-white duration-300 flex flex-col group h-full hover:shadow-[0px_0px_10px_1px_#00000026] lg:p-[30px] p-5 rounded-[20px] transition-all"><div class="shimmer h-3 mb-5 w-[60%]"></div><div class="shimmer mb-6 h-5 w-[75%]"></div><div class=mb-6><div class="shimmer h-3 w-full mb-2"></div><div class="shimmer h-3 w-full mb-3"></div><div class="shimmer h-3 w-[70%]"></div></div><div class="shimmer h-3 mb-6 w-[80%]"></div><div class="shimmer h-3 w-[70%]"></div><div class="mt-auto pt-6"><div class="shimmer w-[60%] h-4"></div></div></div></div><div class="w-full lg:mt-4 lg:px-4 lg:w-1/3 mt-6 px-2 sm:w-1/2 xl:w-1/4"><div class="w-full bg-white duration-300 flex flex-col group h-full hover:shadow-[0px_0px_10px_1px_#00000026] lg:p-[30px] p-5 rounded-[20px] transition-all"><div class="shimmer h-3 mb-5 w-[60%]"></div><div class="shimmer mb-6 h-5 w-[75%]"></div><div class=mb-6><div class="shimmer h-3 w-full mb-2"></div><div class="shimmer h-3 w-full mb-3"></div><div class="shimmer h-3 w-[70%]"></div></div><div class="shimmer h-3 mb-6 w-[80%]"></div><div class="shimmer h-3 w-[70%]"></div><div class="mt-auto pt-6"><div class="shimmer w-[60%] h-4"></div></div></div></div>');
            },
            success: function(response) {
                console.log(response);
                $('#store-listing').html(response.data.html);
                $('#store-pagination').html(response.data.pagination);
            }
        });
    }
    
 
 
 
    $('#store-city-filter').on('change', function() {
		$('#storename').val("");
        loadStores(1, $(this).val());
    });

	$('#storename').on('keyup keydown', function () {
		var city = $('#store-city-filter').val();
		loadStoresBYname(1, $(this).val() , city);
	});





    
    $(document).on('click', '.store-pagination-link', function(e) {
        e.preventDefault();
        const page = $(this).data('page');
        const city = $('#store-city-filter').val();
        loadStores(page, city);
    });
    
    loadStores(); // Initial load


document.addEventListener("DOMContentLoaded", function () {
    const footerStrip = document.getElementById("footerStrip");
    const closeBtn = document.querySelector(".footerStrip-close");

    // If footer strip does not exist, stop execution
    if (!footerStrip || !closeBtn) {
        return;
    }

    // Check if user already closed the footer strip
    if (localStorage.getItem("footerStripClosed") !== "true") {
        footerStrip.style.display = "block";
    } else {
        footerStrip.style.display = "none";
    }

    // Close button logic
    closeBtn.addEventListener("click", function () {
        footerStrip.style.display = "none";
        localStorage.setItem("footerStripClosed", "true");
    });
});

// 	document.addEventListener("DOMContentLoaded", function () {
// 		const footerStrip = document.getElementById("footerStrip");
// 		const closeBtn = document.querySelector(".footerStrip-close");

// 		// Check if user already closed the footerStrip
// 		if (localStorage.getItem("footerStripClosed") != "true") {
// 			footerStrip.style.display = "block";	
// 		} else{
// 			footerStrip.style.display = "none";	
// 		}

// 		// Close button logic
// 		closeBtn.addEventListener("click", function () {
// 			footerStrip.style.display = "none";
// 			localStorage.setItem("footerStripClosed", "true");
// 		});
// 	});


	$('#store-city-filter').select2(); // Enables Select2 with search


	$(window).on("load", function () {
		var form = $("form"); // Adjust selector if needed

		if (form.find("select.state_auto").length > 0) {
			// Set default country ID (if you have a static one)
			var cnt = "101"; // Example: India ID — replace with actual
			form.find("select.state_auto").html('<option value="0001" data-id="0001">Loading...</option>');
			form.find("select.city_auto").html('<option value="0" data-id="0">Select City</option>');

			jQuery.ajax({
				url: tc_csca_auto_ajax.ajax_url,
				type: 'post',
				dataType: "json",
				data: {
					action: "tc_csca_get_states",
					nonce_ajax: tc_csca_auto_ajax.nonce,
					cnt: cnt
				},
				success: function (response) {
					if (response.length > 0) {
						form.find("select.state_auto").html('<option value="0" data-id="0">Select State</option>');
						for (var i = 0; i < response.length; i++) {
							var st_id = response[i]['id'];
							var st_name = response[i]['name'];
							var opt = "<option data-id='" + st_id + "' value='" + st_name + "'>" + st_name + "</option>";
							form.find("select.state_auto").append(opt);
						}
					} else {
						form.find("select.state_auto").html('<option value="0">State List Not Found</option>');
						console.log("State List Not Found");
					}
				}
			});
		}
	});



})(jQuery);