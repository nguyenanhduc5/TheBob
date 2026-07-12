using System.Threading.Tasks;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using THEBOB.Data;
using THEBOB.Models;
using THEBOB.Models.LiveChat;

namespace THEBOB.Controllers
{
    [ApiController]
    [Route("api/faq")]
    [Authorize(Roles = "Admin")]
    public class FaqController : ControllerBase
    {
        private readonly ThebobDbContext _context;

        public FaqController(ThebobDbContext context)
        {
            _context = context;
        }

        [HttpGet]
        public async Task<IActionResult> GetAll()
        {
            var faqs = await _context.Faqs
                .OrderByDescending(f => f.Priority)
                .ThenBy(f => f.Id)
                .ToListAsync();

            return Ok(ApiResponse<object>.Ok(faqs));
        }

        [HttpPost]
        public async Task<IActionResult> Create([FromBody] Faq faq)
        {
            if (!ModelState.IsValid)
            {
                return BadRequest(ApiResponse<object>.Fail("Dữ liệu không hợp lệ."));
            }

            _context.Faqs.Add(faq);
            await _context.SaveChangesAsync();

            return Ok(ApiResponse<Faq>.Ok(faq));
        }

        [HttpPut("{id}")]
        public async Task<IActionResult> Update(int id, [FromBody] Faq faq)
        {
            if (id != faq.Id)
            {
                return BadRequest(ApiResponse<object>.Fail("ID không khớp."));
            }

            var existing = await _context.Faqs.FindAsync(id);
            if (existing == null)
            {
                return NotFound(ApiResponse<object>.Fail("Không tìm thấy FAQ."));
            }

            existing.Question = faq.Question;
            existing.Answer = faq.Answer;
            existing.Keywords = faq.Keywords;
            existing.Priority = faq.Priority;
            existing.IsActive = faq.IsActive;

            await _context.SaveChangesAsync();
            return Ok(ApiResponse<Faq>.Ok(existing));
        }

        [HttpDelete("{id}")]
        public async Task<IActionResult> Delete(int id)
        {
            var existing = await _context.Faqs.FindAsync(id);
            if (existing == null)
            {
                return NotFound(ApiResponse<object>.Fail("Không tìm thấy FAQ."));
            }

            // Hard delete
            _context.Faqs.Remove(existing);
            await _context.SaveChangesAsync();

            return Ok(ApiResponse<object>.Ok(new { message = "Deleted" }));
        }
    }
}
