using System.Threading.Tasks;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using THEBOB.Models;
using THEBOB.Models.LiveChat;
using THEBOB.Services.Chat;

namespace THEBOB.Controllers
{
    [ApiController]
    [Route("api/faq")]
    [Authorize(Roles = "Admin")]
    public class FaqController : ControllerBase
    {
        private readonly IFaqService _faqService;

        public FaqController(IFaqService faqService)
        {
            _faqService = faqService;
        }

        [HttpGet]
        public async Task<IActionResult> GetAll()
        {
            var faqs = await _faqService.GetAllFaqsAsync();
            return Ok(ApiResponse<object>.Ok(faqs));
        }

        [HttpPost]
        public async Task<IActionResult> Create([FromBody] Faq faq)
        {
            if (!ModelState.IsValid)
            {
                return BadRequest(ApiResponse<object>.Fail("Dữ liệu không hợp lệ."));
            }

            var created = await _faqService.CreateFaqAsync(faq);
            return Ok(ApiResponse<Faq>.Ok(created));
        }

        [HttpPut("{id}")]
        public async Task<IActionResult> Update(int id, [FromBody] Faq faq)
        {
            if (id != faq.Id)
            {
                return BadRequest(ApiResponse<object>.Fail("ID không khớp."));
            }

            var updated = await _faqService.UpdateFaqAsync(id, faq);
            if (updated == null)
            {
                return NotFound(ApiResponse<object>.Fail("Không tìm thấy FAQ."));
            }

            return Ok(ApiResponse<Faq>.Ok(updated));
        }

        [HttpDelete("{id}")]
        public async Task<IActionResult> Delete(int id)
        {
            var success = await _faqService.DeleteFaqAsync(id);
            if (!success)
            {
                return NotFound(ApiResponse<object>.Fail("Không tìm thấy FAQ."));
            }

            return Ok(ApiResponse<object>.Ok(new { message = "Deleted" }));
        }
    }
}
