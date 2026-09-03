require 'json'

module Jekyll
  class TypeThemeGenerator < Generator
    safe true
    priority :normal

    def generate(site)
      items = load_json(site, '_data_src/themes.json')
      Jekyll.logger.info "TypeThemeGenerator:", "#{items.size}개 테마 페이지 생성 중..."
      items.each do |c|
        next if c['slug'].to_s.strip.empty?
        site.pages << TypeThemePage.new(site, c)
      end
      Jekyll.logger.info "TypeThemeGenerator:", "완료 (#{items.size}개)"
    end

    private

    def load_json(site, path)
      file = File.join(site.source, path)
      return [] unless File.exist?(file)
      JSON.parse(File.read(file, encoding: 'utf-8'))
    rescue => e
      Jekyll.logger.warn "TypeThemeGenerator:", "#{path} 로드 실패: #{e.message}"
      []
    end
  end

  class TypeThemePage < Page
    def initialize(site, c)
      @site = site
      @base = site.source
      @dir  = "type/#{c['slug']}"
      @name = 'index.html'

      self.process(@name)
      self.read_yaml(File.join(@base, '_layouts'), 'type-theme.html')
      self.data.merge!(c)
      self.data['layout']      = 'type-theme'
      self.data['title']       = "#{c['themeName']} 타자연습 - 타수 측정 게임"
      self.data['description'] = "#{c['themeName']} 이름으로 즐기는 타자연습 게임. 타수와 정확도를 바로 확인하고 순위표에 도전하세요."
    end
  end
end
